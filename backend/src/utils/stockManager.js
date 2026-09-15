const { Op } = require('sequelize');
const { Medication, MedicationBatch, StockLedgerEntry } = require('../models');

/**
 * Utility to deduct medication stock with full safety checks:
 * 1. Transaction wrapping
 * 2. Medication active & existence validation
 * 3. Batch & item expiry date validation (rejects expired stock)
 * 4. Strict oversell protection (rejects when requested quantity > available stock)
 * 5. FEFO batch stock allocation (where MedicationBatch records exist)
 * 6. StockLedgerEntry creation (entryType: 'sale')
 */
async function deductMedicationStock({
  medicationId,
  quantity,
  referenceType = 'prescription',
  referenceId = null,
  notes = null,
  hospitalId = null,
  userId = null,
  transaction = null,
}) {
  const qty = Number(quantity || 0);
  if (!qty || qty <= 0) {
    throw new Error('Quantity must be greater than zero');
  }

  const queryOptions = {};
  if (transaction) {
    queryOptions.transaction = transaction;
    queryOptions.lock = transaction.LOCK.UPDATE;
  }

  const med = await Medication.findByPk(medicationId, queryOptions);
  if (!med) {
    throw new Error('Medication not found');
  }

  const effectiveHospitalId = hospitalId || med.hospitalId;
  const today = new Date().toISOString().slice(0, 10);

  // 1. Expiry Check on Medication itself
  if (med.expiryDate && med.expiryDate < today) {
    throw new Error(`Medication "${med.name}" is expired (expiry date: ${med.expiryDate})`);
  }

  // 2. Oversell Protection Check on aggregate stock
  const currentStock = Number(med.stockQuantity || 0);
  if (currentStock < qty) {
    throw new Error(`Insufficient stock for "${med.name}". Available ${currentStock}, requested ${qty}`);
  }

  // 3. Batch Expiry & Allocation Check
  const activeBatches = await MedicationBatch.findAll({
    where: {
      medicationId: med.id,
      hospitalId: effectiveHospitalId,
      quantityOnHand: { [Op.gt]: 0 },
      expiryDate: { [Op.gte]: today },
      isActive: true,
    },
    order: [['expiryDate', 'ASC'], ['purchaseDate', 'ASC'], ['createdAt', 'ASC']],
    ...queryOptions,
  });

  let allocatedBatch = null;
  if (activeBatches.length > 0) {
    const unexpiredBatchQty = activeBatches.reduce((sum, b) => sum + Number(b.quantityOnHand || 0), 0);
    // Include legacy unbatched stock fallback if total stock exceeds batch sum
    const unbatchedLegacyStock = Math.max(0, currentStock - unexpiredBatchQty);
    if ((unexpiredBatchQty + unbatchedLegacyStock) < qty) {
      throw new Error(`Insufficient unexpired batch stock for "${med.name}". Unexpired batch available: ${unexpiredBatchQty}, requested: ${qty}`);
    }

    // Allocate from batches in FEFO order
    let remaining = qty;
    for (const batch of activeBatches) {
      if (remaining <= 0) break;
      const canTake = Math.min(Number(batch.quantityOnHand || 0), remaining);
      if (canTake <= 0) continue;
      if (!allocatedBatch) allocatedBatch = batch;
      const newBatchQty = Number((Number(batch.quantityOnHand || 0) - canTake).toFixed(2));
      await batch.update({ quantityOnHand: newBatchQty }, queryOptions);
      remaining -= canTake;
    }
  }

  // 4. Update Medication aggregate stock
  const nextStock = Number((currentStock - qty).toFixed(2));
  await med.update({ stockQuantity: nextStock }, queryOptions);

  // 5. Create StockLedgerEntry
  const ledgerEntry = await StockLedgerEntry.create({
    hospitalId: effectiveHospitalId,
    medicationId: med.id,
    batchId: allocatedBatch?.id || null,
    entryDate: today,
    entryType: 'sale',
    quantityIn: 0,
    quantityOut: qty,
    balanceAfter: nextStock,
    referenceType,
    referenceId,
    notes: notes || `${referenceType}: ${med.name} (${qty} ${med.unit || 'pcs'})`,
    createdByUserId: userId,
  }, queryOptions);

  return {
    medication: med,
    previousStock: currentStock,
    nextStock,
    ledgerEntry,
  };
}

/**
 * Utility to restore medication stock on deletion/cancellation with batch restoration & StockLedgerEntry logging.
 */
async function restoreMedicationStock({
  medicationId,
  quantity,
  referenceType = 'prescription',
  referenceId = null,
  notes = null,
  hospitalId = null,
  userId = null,
  transaction = null,
}) {
  const qty = Number(quantity || 0);
  if (!qty || qty <= 0) return null;

  const queryOptions = {};
  if (transaction) {
    queryOptions.transaction = transaction;
    queryOptions.lock = transaction.LOCK.UPDATE;
  }

  const med = await Medication.findByPk(medicationId, queryOptions);
  if (!med) return null;

  const effectiveHospitalId = hospitalId || med.hospitalId;
  const today = new Date().toISOString().slice(0, 10);

  // 1. Look up original stock deduction ledger entries to locate and restore allocated batch(es)
  let targetBatchId = null;
  if (referenceType && referenceId) {
    const originalLedgerEntries = await StockLedgerEntry.findAll({
      where: {
        medicationId: med.id,
        referenceType,
        referenceId,
        entryType: 'sale',
      },
      ...(transaction ? { transaction } : {}),
    });

    let remainingToRestore = qty;
    for (const entry of originalLedgerEntries) {
      if (remainingToRestore <= 0) break;
      if (entry.batchId) {
        const batch = await MedicationBatch.findByPk(entry.batchId, queryOptions);
        if (batch) {
          const restoreAmount = Math.min(Number(entry.quantityOut || 0), remainingToRestore);
          const newBatchQty = Number((Number(batch.quantityOnHand || 0) + restoreAmount).toFixed(2));
          await batch.update({ quantityOnHand: newBatchQty }, queryOptions);
          remainingToRestore -= restoreAmount;
          if (!targetBatchId) targetBatchId = batch.id;
        }
      }
    }
  }

  // 2. Increment Medication aggregate stock
  const currentStock = Number(med.stockQuantity || 0);
  const nextStock = Number((currentStock + qty).toFixed(2));
  await med.update({ stockQuantity: nextStock }, queryOptions);

  // 3. Create StockLedgerEntry for the restoration (entryType: 'sales_return')
  const ledgerEntry = await StockLedgerEntry.create({
    hospitalId: effectiveHospitalId,
    medicationId: med.id,
    batchId: targetBatchId || null,
    entryDate: today,
    entryType: 'sales_return',
    quantityIn: qty,
    quantityOut: 0,
    balanceAfter: nextStock,
    referenceType,
    referenceId,
    notes: notes || `Stock restoration for ${med.name} (${qty} ${med.unit || 'pcs'})`,
    createdByUserId: userId,
  }, queryOptions);

  return {
    medication: med,
    previousStock: currentStock,
    nextStock,
    targetBatchId,
    ledgerEntry,
  };
}

module.exports = {
  deductMedicationStock,
  restoreMedicationStock,
};
