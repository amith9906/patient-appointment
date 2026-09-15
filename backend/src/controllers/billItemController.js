const { BillItem, Appointment, Doctor, Medication, StockLedgerEntry, sequelize } = require('../models');
const { ensureScopedHospital, isSuperAdmin } = require('../utils/accessScope');

// Verify caller has access to this appointment
async function checkAccess(req, res, apptId) {
  const scope = await ensureScopedHospital(req, res);
  if (!scope.allowed) return null;

  const appt = await Appointment.findByPk(apptId);
  if (!appt) { res.status(404).json({ message: 'Appointment not found' }); return null; }

  if (!isSuperAdmin(req.user)) {
    const doctor = await Doctor.findByPk(appt.doctorId, { attributes: ['hospitalId'] });
    if (doctor?.hospitalId !== scope.hospitalId) {
      res.status(403).json({ message: 'Access denied for this appointment' }); return null;
    }
  }
  return appt;
}

// GET /appointments/:id/bill-items
exports.getByAppointment = async (req, res) => {
  try {
    const appt = await checkAccess(req, res, req.params.id);
    if (!appt) return;

    const items = await BillItem.findAll({
      where: { appointmentId: req.params.id },
      order: [['createdAt', 'ASC']],
    });
    res.json(items);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// PUT /appointments/:id/bill-items
// Body: { items: [{ description, category, medicationId, itemType, unit, quantity, unitPrice }] }
exports.saveItems = async (req, res) => {
  const tx = await sequelize.transaction();
  try {
    const appt = await checkAccess(req, res, req.params.id);
    if (!appt) {
      await tx.rollback();
      return;
    }

    const doctor = await Doctor.findByPk(appt.doctorId, { attributes: ['hospitalId'] });
    const hospitalId = doctor?.hospitalId || req.user.hospitalId;

    const { items = [] } = req.body;

    // Build records and validate
    const records = items.map(item => {
      const qty = parseFloat(item.quantity) || 1;
      const price = parseFloat(item.unitPrice) || 0;
      const rate = parseFloat(item.gstRate) || 0;
      const isInterstate = !!item.isInterstate;
      const defaultSac = item.category === 'medication' ? '3004' : item.category === 'lab_test' ? '999313' : '999312';
      const itemSacCode = item.sacCode || defaultSac;

      const amount = parseFloat((qty * price).toFixed(2));
      const gstAmount = parseFloat((amount * rate / 100).toFixed(2));
      const cgstAmount = isInterstate ? 0 : parseFloat((gstAmount / 2).toFixed(2));
      const sgstAmount = isInterstate ? 0 : parseFloat((gstAmount / 2).toFixed(2));
      const igstAmount = isInterstate ? gstAmount : 0;

      return {
        appointmentId: req.params.id,
        medicationId: item.medicationId || null,
        description: String(item.description || '').trim(),
        category: item.category || 'other',
        itemType: item.itemType || item.category || 'other',
        unit: item.unit || 'pcs',
        quantity: qty,
        unitPrice: price,
        amount,
        sacCode: itemSacCode,
        gstRate: rate,
        cgstAmount,
        sgstAmount,
        igstAmount,
      };
    }).filter(r => r.description && r.unitPrice > 0);

    // Replace all items atomically
    await BillItem.destroy({ where: { appointmentId: req.params.id }, transaction: tx });
    const created = records.length ? await BillItem.bulkCreate(records, { transaction: tx }) : [];

    // Deduct stock for any medication bill items & record StockLedgerEntry
    for (const record of created) {
      if (record.medicationId || record.category === 'medication') {
        const med = record.medicationId
          ? await Medication.findByPk(record.medicationId, { transaction: tx, lock: tx.LOCK.UPDATE })
          : await Medication.findOne({ where: { name: record.description, hospitalId }, transaction: tx, lock: tx.LOCK.UPDATE });
        
        if (!med) {
          throw new Error(`Medication "${record.description}" not found in pharmacy inventory`);
        }

        if (Number(record.quantity) > Number(med.stockQuantity)) {
          throw new Error(`Insufficient stock for "${med.name}". Available: ${med.stockQuantity} ${record.unit}, requested: ${record.quantity}`);
        }

        const nextStock = Number(med.stockQuantity) - Number(record.quantity);
        await med.update({ stockQuantity: nextStock }, { transaction: tx });

        await StockLedgerEntry.create({
          hospitalId,
          medicationId: med.id,
          entryDate: new Date().toISOString().slice(0, 10),
          entryType: 'sale',
          quantityIn: 0,
          quantityOut: Number(record.quantity),
          balanceAfter: nextStock,
          referenceType: 'appointment_bill_item',
          referenceId: record.id,
          notes: `Appointment bill item: ${record.description} (${record.quantity} ${record.unit})`,
          createdByUserId: req.user.id,
        }, { transaction: tx });
      }
    }

    // Update appointment.treatmentBill = sum of all item amounts
    const total = created.reduce((s, r) => s + Number(r.amount), 0);
    await appt.update({ treatmentBill: parseFloat(total.toFixed(2)) }, { transaction: tx });
    await tx.commit();

    res.json(created);
  } catch (err) {
    await tx.rollback();
    res.status(400).json({ message: err.message });
  }
};

// PATCH /appointments/:id/mark-paid
exports.markPaid = async (req, res) => {
  try {
    const appt = await checkAccess(req, res, req.params.id);
    if (!appt) return;

    await appt.update({ isPaid: !appt.isPaid });
    res.json({ isPaid: appt.isPaid });
  } catch (err) { res.status(400).json({ message: err.message }); }
};
