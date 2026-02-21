const { Op } = require('sequelize');
const {
  sequelize,
  CorporateAccount,
  CorporateLedgerEntry,
  Appointment,
  Patient,
  Doctor,
} = require('../models');
const { ensureScopedHospital, isSuperAdmin } = require('../utils/accessScope');

const round2 = (n) => Number((Number(n || 0)).toFixed(2));

async function ensureAccountScope(req, res, accountId) {
  const scope = await ensureScopedHospital(req, res);
  if (!scope.allowed) return { allowed: false };
  const account = await CorporateAccount.findByPk(accountId);
  if (!account) {
    res.status(404).json({ message: 'Corporate account not found' });
    return { allowed: false };
  }
  if (!isSuperAdmin(req.user) && account.hospitalId !== scope.hospitalId) {
    res.status(403).json({ message: 'Access denied for this corporate account' });
    return { allowed: false };
  }
  return { allowed: true, scope, account };
}

exports.getAll = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const where = {};
    if (!isSuperAdmin(req.user)) where.hospitalId = scope.hospitalId;
    else if (req.query.hospitalId) where.hospitalId = req.query.hospitalId;
    if (req.query.isActive === 'true') where.isActive = true;
    if (req.query.isActive === 'false') where.isActive = false;
    if (req.query.q) where.name = { [Op.iLike]: `%${String(req.query.q).trim()}%` };

    const accounts = await CorporateAccount.findAll({
      where,
      order: [['name', 'ASC']],
    });

    const ids = accounts.map((a) => a.id);
    const ledger = ids.length ? await CorporateLedgerEntry.findAll({
      where: { corporateAccountId: ids },
      attributes: ['corporateAccountId', 'debitAmount', 'creditAmount'],
    }) : [];

    const map = new Map();
    accounts.forEach((a) => map.set(a.id, { debit: 0, credit: 0 }));
    ledger.forEach((e) => {
      const rec = map.get(e.corporateAccountId) || { debit: 0, credit: 0 };
      rec.debit += Number(e.debitAmount || 0);
      rec.credit += Number(e.creditAmount || 0);
      map.set(e.corporateAccountId, rec);
    });

    const out = accounts.map((a) => {
      const rec = map.get(a.id) || { debit: 0, credit: 0 };
      const opening = Number(a.openingBalance || 0);
      const outstanding = round2(opening + rec.debit - rec.credit);
      return {
        ...a.toJSON(),
        ledgerSummary: {
          debit: round2(rec.debit),
          credit: round2(rec.credit),
          openingBalance: round2(opening),
          outstanding,
        },
      };
    });
    res.json(out);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.create = async (req, res) => {
  const tx = await sequelize.transaction();
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) {
      await tx.rollback();
      return;
    }

    const {
      name,
      accountCode,
      gstin,
      contactPerson,
      phone,
      email,
      address,
      creditDays,
      creditLimit,
      openingBalance,
      notes,
      hospitalId,
    } = req.body || {};

    if (!name || !String(name).trim()) {
      await tx.rollback();
      return res.status(400).json({ message: 'Corporate account name is required' });
    }

    const finalHospitalId = isSuperAdmin(req.user) ? (hospitalId || scope.hospitalId) : scope.hospitalId;
    if (!finalHospitalId) {
      await tx.rollback();
      return res.status(400).json({ message: 'hospitalId is required' });
    }

    const acc = await CorporateAccount.create({
      hospitalId: finalHospitalId,
      name: String(name).trim(),
      accountCode: accountCode || null,
      gstin: gstin || null,
      contactPerson: contactPerson || null,
      phone: phone || null,
      email: email || null,
      address: address || null,
      creditDays: Number(creditDays || 30),
      creditLimit: round2(Number(creditLimit || 0)),
      openingBalance: round2(Number(openingBalance || 0)),
      notes: notes || null,
      isActive: true,
    }, { transaction: tx });

    if (Number(openingBalance || 0) !== 0) {
      await CorporateLedgerEntry.create({
        hospitalId: finalHospitalId,
        corporateAccountId: acc.id,
        entryType: 'opening',
        entryDate: new Date().toISOString().slice(0, 10),
        referenceNumber: 'OPENING',
        debitAmount: Number(openingBalance || 0) > 0 ? round2(Number(openingBalance)) : 0,
        creditAmount: Number(openingBalance || 0) < 0 ? round2(Math.abs(Number(openingBalance))) : 0,
        notes: 'Opening balance',
        createdByUserId: req.user.id,
      }, { transaction: tx });
    }

    await tx.commit();
    res.status(201).json(acc);
  } catch (err) {
    await tx.rollback();
    res.status(400).json({ message: err.message || 'Failed to create corporate account' });
  }
};

exports.update = async (req, res) => {
  try {
    const scoped = await ensureAccountScope(req, res, req.params.id);
    if (!scoped.allowed) return;
    const { account } = scoped;
    await account.update(req.body || {});
    res.json(account);
  } catch (err) {
    res.status(400).json({ message: err.message || 'Failed to update corporate account' });
  }
};

exports.delete = async (req, res) => {
  try {
    const scoped = await ensureAccountScope(req, res, req.params.id);
    if (!scoped.allowed) return;
    const { account } = scoped;
    await account.update({ isActive: false });
    res.json({ message: 'Corporate account archived' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getLedger = async (req, res) => {
  try {
    const scoped = await ensureAccountScope(req, res, req.params.id);
    if (!scoped.allowed) return;
    const { account } = scoped;

    const where = { corporateAccountId: account.id };
    if (req.query.from && req.query.to) where.entryDate = { [Op.between]: [req.query.from, req.query.to] };
    else if (req.query.from) where.entryDate = { [Op.gte]: req.query.from };
    else if (req.query.to) where.entryDate = { [Op.lte]: req.query.to };

    const entries = await CorporateLedgerEntry.findAll({
      where,
      include: [
        {
          model: Appointment,
          as: 'appointment',
          attributes: ['id', 'appointmentNumber', 'appointmentDate', 'billingType'],
          include: [
            { model: Patient, as: 'patient', attributes: ['id', 'name', 'patientId'] },
            { model: Doctor, as: 'doctor', attributes: ['id', 'name'] },
          ],
        },
      ],
      order: [['entryDate', 'DESC'], ['createdAt', 'DESC']],
    });

    let debit = 0;
    let credit = 0;
    entries.forEach((e) => {
      debit += Number(e.debitAmount || 0);
      credit += Number(e.creditAmount || 0);
    });
    const opening = Number(account.openingBalance || 0);
    const outstanding = round2(opening + debit - credit);

    res.json({
      account,
      summary: {
        openingBalance: round2(opening),
        totalDebit: round2(debit),
        totalCredit: round2(credit),
        outstanding,
      },
      entries,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.postAppointmentInvoice = async (req, res) => {
  const tx = await sequelize.transaction();
  try {
    const scoped = await ensureAccountScope(req, res, req.params.id);
    if (!scoped.allowed) {
      await tx.rollback();
      return;
    }
    const { account } = scoped;

    const appointmentRef = String(req.body.appointmentId || '').trim();
    if (!appointmentRef) {
      await tx.rollback();
      return res.status(400).json({ message: 'Appointment ID or appointment number is required' });
    }

    const appt = await Appointment.findOne({
      where: {
        hospitalId: account.hospitalId,
        [Op.or]: [
          { id: appointmentRef },
          { appointmentNumber: appointmentRef },
        ],
      },
      transaction: tx,
      lock: tx.LOCK.UPDATE,
    });
    if (!appt) {
      await tx.rollback();
      return res.status(404).json({ message: 'Appointment not found' });
    }
    if (appt.corporateAccountId && appt.corporateAccountId !== account.id) {
      await tx.rollback();
      return res.status(400).json({ message: 'Appointment already linked to another corporate account' });
    }

    const amount = round2(Number(req.body.amount || (Number(appt.fee || 0) + Number(appt.treatmentBill || 0))));
    if (amount <= 0) {
      await tx.rollback();
      return res.status(400).json({ message: 'Invoice amount must be greater than 0' });
    }

    const invoiceDate = req.body.invoiceDate || new Date().toISOString().slice(0, 10);
    const dueDate = req.body.dueDate || new Date(new Date(invoiceDate).getTime() + (Number(account.creditDays || 30) * 86400000)).toISOString().slice(0, 10);
    const invoiceNumber = req.body.invoiceNumber || `CORP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-6)}`;

    await CorporateLedgerEntry.create({
      hospitalId: account.hospitalId,
      corporateAccountId: account.id,
      appointmentId: appt.id,
      entryType: 'invoice',
      entryDate: invoiceDate,
      referenceNumber: invoiceNumber,
      debitAmount: amount,
      creditAmount: 0,
      notes: req.body.notes || `Corporate invoice for appointment ${appt.appointmentNumber}`,
      createdByUserId: req.user.id,
    }, { transaction: tx });

    await appt.update({
      billingType: 'corporate',
      corporateAccountId: account.id,
      corporateInvoiceNumber: invoiceNumber,
      corporateInvoiceDate: invoiceDate,
      corporateDueDate: dueDate,
      corporatePaymentStatus: 'billed',
    }, { transaction: tx });

    await tx.commit();
    res.status(201).json({ message: 'Corporate invoice posted', appointmentId: appt.id, invoiceNumber });
  } catch (err) {
    await tx.rollback();
    res.status(400).json({ message: err.message || 'Failed to post corporate invoice' });
  }
};

exports.postPayment = async (req, res) => {
  const tx = await sequelize.transaction();
  try {
    const scoped = await ensureAccountScope(req, res, req.params.id);
    if (!scoped.allowed) {
      await tx.rollback();
      return;
    }
    const { account } = scoped;

    const amount = round2(Number(req.body.amount || 0));
    if (amount <= 0) {
      await tx.rollback();
      return res.status(400).json({ message: 'Payment amount must be greater than 0' });
    }

    const entry = await CorporateLedgerEntry.create({
      hospitalId: account.hospitalId,
      corporateAccountId: account.id,
      appointmentId: req.body.appointmentId || null,
      entryType: 'payment',
      entryDate: req.body.paymentDate || new Date().toISOString().slice(0, 10),
      referenceNumber: req.body.referenceNumber || null,
      debitAmount: 0,
      creditAmount: amount,
      notes: req.body.notes || 'Corporate payment received',
      createdByUserId: req.user.id,
    }, { transaction: tx });

    if (req.body.appointmentId) {
      const appt = await Appointment.findByPk(req.body.appointmentId, { transaction: tx, lock: tx.LOCK.UPDATE });
      if (appt) {
        await appt.update({
          corporatePaymentStatus: 'paid',
          isPaid: true,
        }, { transaction: tx });
      }
    }

    await tx.commit();
    res.status(201).json(entry);
  } catch (err) {
    await tx.rollback();
    res.status(400).json({ message: err.message || 'Failed to post payment' });
  }
};

