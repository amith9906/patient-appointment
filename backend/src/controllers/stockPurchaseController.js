const { Op } = require('sequelize');
const {
  sequelize,
  StockPurchase,
  StockPurchaseReturn,
  Medication,
  MedicationBatch,
  StockLedgerEntry,
  Vendor,
  User,
} = require('../models');
const { ensureScopedHospital, isSuperAdmin } = require('../utils/accessScope');

const round2 = (v) => Number(Number(v || 0).toFixed(2));

exports.getAll = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { from, to, vendorId, medicationId, search } = req.query;
    const where = {};
    if (!isSuperAdmin(req.user)) where.hospitalId = scope.hospitalId;
    else if (req.query.hospitalId) where.hospitalId = req.query.hospitalId;
    if (vendorId) where.vendorId = vendorId;
    if (medicationId) where.medicationId = medicationId;
    if (from || to) {
      where.purchaseDate = {};
      if (from) where.purchaseDate[Op.gte] = from;
      if (to) where.purchaseDate[Op.lte] = to;
    }
    if (search) {
      where.invoiceNumber = { [Op.iLike]: `%${search}%` };
    }

    const purchases = await StockPurchase.findAll({
      where,
      include: [
        { model: Medication, as: 'medication', attributes: ['id', 'name', 'category', 'dosage', 'gstRate', 'hsnCode'] },
        { model: Vendor, as: 'vendor', attributes: ['id', 'name', 'gstin', 'isActive'] },
        { model: User, as: 'createdBy', attributes: ['id', 'name', 'email'] },
      ],
      order: [['purchaseDate', 'DESC'], ['createdAt', 'DESC']],
    });

    res.json(purchases);
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
      medicationId,
      vendorId,
      invoiceNumber,
      purchaseDate,
      quantity,
      unitCost,
      discountPct = 0,
      taxPct,
      batchNo,
      mfgDate,
      expiryDate,
      notes,
    } = req.body;

    const hospitalId = isSuperAdmin(req.user) ? req.body.hospitalId : scope.hospitalId;
    if (!hospitalId) {
      await tx.rollback();
      return res.status(400).json({ message: 'hospitalId is required' });
    }
    if (!medicationId) {
      await tx.rollback();
      return res.status(400).json({ message: 'medicationId is required' });
    }

    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      await tx.rollback();
      return res.status(400).json({ message: 'Quantity must be a positive whole number' });
    }

    const med = await Medication.findByPk(medicationId, { transaction: tx, lock: tx.LOCK.UPDATE });
    if (!med || !med.isActive) {
      await tx.rollback();
      return res.status(400).json({ message: 'Medication not found' });
    }
    if (med.hospitalId !== hospitalId) {
      await tx.rollback();
      return res.status(400).json({ message: 'Medication belongs to another hospital' });
    }

    let vendor = null;
    if (vendorId) {
      vendor = await Vendor.findByPk(vendorId, { transaction: tx });
      if (!vendor) {
        await tx.rollback();
        return res.status(400).json({ message: 'Vendor not found' });
      }
      if (vendor.hospitalId !== hospitalId) {
        await tx.rollback();
        return res.status(400).json({ message: 'Vendor belongs to another hospital' });
      }
    }

    const cost = Number(unitCost || med.purchasePrice || 0);
    const discPct = Number(discountPct || 0);
    const gstPct = Number(taxPct ?? med.gstRate ?? 0);
    const effectiveExpiry = expiryDate || med.expiryDate || '2099-12-31';
    const taxableBase = round2(qty * cost);
    const discountAmt = round2((taxableBase * discPct) / 100);
    const taxableAmount = round2(taxableBase - discountAmt);
    const taxAmount = round2((taxableAmount * gstPct) / 100);
    const totalAmount = round2(taxableAmount + taxAmount);

    const purchase = await StockPurchase.create({
      hospitalId,
      medicationId,
      vendorId: vendorId || null,
      createdByUserId: req.user.id,
      invoiceNumber: invoiceNumber || null,
      purchaseDate: purchaseDate || new Date().toISOString().slice(0, 10),
      quantity: qty,
      unitCost: round2(cost),
      discountPct: round2(discPct),
      taxPct: round2(gstPct),
      taxableAmount,
      taxAmount,
      totalAmount,
      notes: notes || null,
    }, { transaction: tx });

    await med.update({
      stockQuantity: Number(med.stockQuantity || 0) + qty,
      purchasePrice: round2(cost),
      supplierName: vendor?.name || med.supplierName,
    }, { transaction: tx });

    const normalizedBatchNo = String(batchNo || `AUTO-${purchase.id.slice(0, 8)}`).trim().toUpperCase();
    let batch = await MedicationBatch.findOne({
      where: { hospitalId, medicationId, batchNo: normalizedBatchNo },
      transaction: tx,
      lock: tx.LOCK.UPDATE,
    });
    if (batch) {
      await batch.update({
        quantityOnHand: Number(batch.quantityOnHand || 0) + qty,
        unitCost: round2(cost),
        expiryDate: effectiveExpiry,
        mfgDate: mfgDate || batch.mfgDate,
        purchaseDate: purchaseDate || batch.purchaseDate,
      }, { transaction: tx });
    } else {
      batch = await MedicationBatch.create({
        hospitalId,
        medicationId,
        batchNo: normalizedBatchNo,
        mfgDate: mfgDate || null,
        expiryDate: effectiveExpiry,
        purchaseDate: purchaseDate || new Date().toISOString().slice(0, 10),
        quantityOnHand: qty,
        unitCost: round2(cost),
        notes: notes || null,
      }, { transaction: tx });
    }

    await StockLedgerEntry.create({
      hospitalId,
      medicationId,
      batchId: batch.id,
      entryDate: purchaseDate || new Date().toISOString().slice(0, 10),
      entryType: 'purchase',
      quantityIn: qty,
      quantityOut: 0,
      balanceAfter: Number(med.stockQuantity || 0) + qty,
      referenceType: 'stock_purchase',
      referenceId: purchase.id,
      notes: notes || null,
      createdByUserId: req.user.id,
    }, { transaction: tx });

    await tx.commit();

    const created = await StockPurchase.findByPk(purchase.id, {
      include: [
        { model: Medication, as: 'medication', attributes: ['id', 'name', 'category', 'dosage', 'gstRate', 'hsnCode'] },
        { model: Vendor, as: 'vendor', attributes: ['id', 'name', 'gstin', 'isActive'] },
        { model: User, as: 'createdBy', attributes: ['id', 'name', 'email'] },
      ],
    });
    res.status(201).json(created);
  } catch (err) {
    await tx.rollback();
    res.status(400).json({ message: err.message || 'Failed to create purchase' });
  }
};

exports.getReturns = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const purchase = await StockPurchase.findByPk(req.params.id);
    if (!purchase) return res.status(404).json({ message: 'Purchase not found' });
    if (!isSuperAdmin(req.user) && purchase.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital purchase' });
    }

    const returns = await StockPurchaseReturn.findAll({
      where: { stockPurchaseId: purchase.id },
      include: [
        { model: Medication, as: 'medication', attributes: ['id', 'name', 'category'] },
        { model: Vendor, as: 'vendor', attributes: ['id', 'name', 'gstin'] },
        { model: User, as: 'createdBy', attributes: ['id', 'name', 'email'] },
      ],
      order: [['returnDate', 'DESC'], ['createdAt', 'DESC']],
    });
    res.json(returns);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createReturn = async (req, res) => {
  const tx = await sequelize.transaction();
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) {
      await tx.rollback();
      return;
    }

    const purchase = await StockPurchase.findByPk(req.params.id, { transaction: tx, lock: tx.LOCK.UPDATE });
    if (!purchase) {
      await tx.rollback();
      return res.status(404).json({ message: 'Purchase not found' });
    }
    if (!isSuperAdmin(req.user) && purchase.hospitalId !== scope.hospitalId) {
      await tx.rollback();
      return res.status(403).json({ message: 'Access denied for this hospital purchase' });
    }

    const { quantity, reason, notes, returnDate } = req.body || {};
    const qty = Number(quantity || 0);
    if (!Number.isInteger(qty) || qty <= 0) {
      await tx.rollback();
      return res.status(400).json({ message: 'Return quantity must be a positive whole number' });
    }

    const existingReturns = await StockPurchaseReturn.findAll({
      where: { stockPurchaseId: purchase.id },
      transaction: tx,
    });
    const alreadyReturned = existingReturns.reduce((s, r) => s + Number(r.quantity || 0), 0);
    const remaining = Number(purchase.quantity || 0) - alreadyReturned;
    if (qty > remaining) {
      await tx.rollback();
      return res.status(400).json({ message: 'Return quantity exceeds remaining purchase quantity' });
    }

    const medication = await Medication.findByPk(purchase.medicationId, { transaction: tx, lock: tx.LOCK.UPDATE });
    if (!medication) {
      await tx.rollback();
      return res.status(400).json({ message: 'Medication not found for this purchase' });
    }
    if (Number(medication.stockQuantity || 0) < qty) {
      await tx.rollback();
      return res.status(400).json({ message: 'Insufficient current stock to process this return' });
    }

    const candidateBatches = await MedicationBatch.findAll({
      where: {
        hospitalId: purchase.hospitalId,
        medicationId: purchase.medicationId,
        quantityOnHand: { [Op.gt]: 0 },
      },
      order: [['expiryDate', 'ASC'], ['purchaseDate', 'ASC'], ['createdAt', 'ASC']],
      transaction: tx,
      lock: tx.LOCK.UPDATE,
    });
    let toDeduct = qty;
    for (const b of candidateBatches) {
      if (toDeduct <= 0) break;
      const canTake = Math.min(Number(b.quantityOnHand || 0), toDeduct);
      if (canTake <= 0) continue;
      await b.update({ quantityOnHand: Number(b.quantityOnHand || 0) - canTake }, { transaction: tx });
      toDeduct -= canTake;
    }
    if (toDeduct > 0) {
      await tx.rollback();
      return res.status(400).json({ message: 'Batch stock mismatch: insufficient lot quantity for return' });
    }

    const perUnitTaxable = Number(purchase.quantity || 0) > 0
      ? Number(purchase.taxableAmount || 0) / Number(purchase.quantity || 0)
      : 0;
    const perUnitTax = Number(purchase.quantity || 0) > 0
      ? Number(purchase.taxAmount || 0) / Number(purchase.quantity || 0)
      : 0;
    const taxableAmount = round2(perUnitTaxable * qty);
    const taxAmount = round2(perUnitTax * qty);
    const totalAmount = round2(taxableAmount + taxAmount);

    const ret = await StockPurchaseReturn.create({
      hospitalId: purchase.hospitalId,
      stockPurchaseId: purchase.id,
      medicationId: purchase.medicationId,
      vendorId: purchase.vendorId || null,
      createdByUserId: req.user.id,
      returnDate: returnDate || new Date().toISOString().slice(0, 10),
      quantity: qty,
      unitCost: round2(Number(purchase.unitCost || 0)),
      taxPct: round2(Number(purchase.taxPct || 0)),
      taxableAmount,
      taxAmount,
      totalAmount,
      reason: reason || null,
      notes: notes || null,
    }, { transaction: tx });

    await medication.update({
      stockQuantity: Number(medication.stockQuantity || 0) - qty,
    }, { transaction: tx });

    await StockLedgerEntry.create({
      hospitalId: purchase.hospitalId,
      medicationId: purchase.medicationId,
      batchId: null,
      entryDate: returnDate || new Date().toISOString().slice(0, 10),
      entryType: 'purchase_return',
      quantityIn: 0,
      quantityOut: qty,
      balanceAfter: Number(medication.stockQuantity || 0) - qty,
      referenceType: 'stock_purchase_return',
      referenceId: ret.id,
      notes: reason || notes || null,
      createdByUserId: req.user.id,
    }, { transaction: tx });

    await tx.commit();

    const created = await StockPurchaseReturn.findByPk(ret.id, {
      include: [
        { model: Medication, as: 'medication', attributes: ['id', 'name', 'category'] },
        { model: Vendor, as: 'vendor', attributes: ['id', 'name', 'gstin'] },
        { model: User, as: 'createdBy', attributes: ['id', 'name', 'email'] },
      ],
    });
    res.status(201).json(created);
  } catch (err) {
    await tx.rollback();
    res.status(400).json({ message: err.message || 'Failed to create purchase return' });
  }
};
