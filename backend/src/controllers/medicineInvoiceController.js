const { Op } = require('sequelize');
const {
  sequelize,
  MedicineInvoice,
  MedicineInvoiceItem,
  MedicineInvoiceReturn,
  MedicineInvoiceReturnItem,
  Medication,
  MedicationBatch,
  StockLedgerEntry,
  StockPurchase,
  StockPurchaseReturn,
  Patient,
  User,
} = require('../models');
const { ensureScopedHospital, isSuperAdmin } = require('../utils/accessScope');

const round2 = (value) => Number(Number(value || 0).toFixed(2));
const withinTolerance = (a, b, tolerance = 0.5) => Math.abs(Number(a || 0) - Number(b || 0)) <= tolerance;
const parseRequestKey = (value) => String(value || '').trim().toLowerCase();

function applyDateRange(where, fieldName, from, to) {
  if (from && to) where[fieldName] = { [Op.between]: [from, to] };
  else if (from) where[fieldName] = { [Op.gte]: from };
  else if (to) where[fieldName] = { [Op.lte]: to };
}

exports.getAll = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { from, to, patientId, isPaid, search } = req.query;
    const where = {};

    if (!isSuperAdmin(req.user)) where.hospitalId = scope.hospitalId;
    if (patientId) where.patientId = patientId;
    if (isPaid === 'true') where.isPaid = true;
    if (isPaid === 'false') where.isPaid = false;
    if (from && to) where.invoiceDate = { [Op.between]: [from, to] };
    else if (from) where.invoiceDate = { [Op.gte]: from };
    else if (to) where.invoiceDate = { [Op.lte]: to };
    if (search) where.invoiceNumber = { [Op.iLike]: `%${search}%` };

    const invoices = await MedicineInvoice.findAll({
      where,
      include: [
        { model: Patient, as: 'patient', attributes: ['id', 'name', 'patientId', 'phone'] },
        { model: User, as: 'soldBy', attributes: ['id', 'name', 'email'] },
        { model: MedicineInvoiceItem, as: 'items', attributes: ['id', 'quantity', 'lineTotal'] },
      ],
      order: [['invoiceDate', 'DESC'], ['createdAt', 'DESC']],
    });

    res.json(invoices);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const invoice = await MedicineInvoice.findByPk(req.params.id, {
      include: [
        { model: Patient, as: 'patient', attributes: ['id', 'name', 'patientId', 'phone', 'email'] },
        { model: User, as: 'soldBy', attributes: ['id', 'name', 'email'] },
        {
          model: MedicineInvoiceItem,
          as: 'items',
          include: [{ model: Medication, as: 'medication', attributes: ['id', 'name', 'genericName', 'category'] }],
        },
      ],
    });

    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (!isSuperAdmin(req.user) && invoice.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital invoice' });
    }

    res.json(invoice);
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
      patientId,
      invoiceDate,
      paymentMode = 'cash',
      isPaid = true,
      notes,
      items = [],
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      await tx.rollback();
      return res.status(400).json({ message: 'At least one medicine item is required' });
    }

    const hospitalId = isSuperAdmin(req.user)
      ? (req.body.hospitalId || null)
      : scope.hospitalId;

    if (!hospitalId) {
      await tx.rollback();
      return res.status(400).json({ message: 'hospitalId is required for super admin' });
    }

    if (patientId) {
      const patient = await Patient.findByPk(patientId, { attributes: ['id', 'hospitalId'], transaction: tx });
      if (!patient) {
        await tx.rollback();
        return res.status(400).json({ message: 'Patient not found' });
      }
      if (patient.hospitalId !== hospitalId) {
        await tx.rollback();
        return res.status(400).json({ message: 'Patient belongs to another hospital' });
      }
    }

    if (items.some((x) => !x.medicationId)) {
      await tx.rollback();
      return res.status(400).json({ message: 'Each item must include medicationId' });
    }
    const medicationIds = [...new Set(items.map((x) => x.medicationId))];

    const medications = await Medication.findAll({
      where: { id: medicationIds, hospitalId, isActive: true },
      transaction: tx,
      lock: tx.LOCK.UPDATE,
    });

    if (medications.length !== medicationIds.length) {
      await tx.rollback();
      return res.status(400).json({ message: 'One or more medications are invalid for this hospital' });
    }

    const medMap = new Map(medications.map((m) => [m.id, m]));

    let subtotal = 0;
    let discountAmount = 0;
    let taxAmount = 0;
    const saleDate = (invoiceDate || new Date().toISOString().slice(0, 10));

    const batches = await MedicationBatch.findAll({
      where: {
        hospitalId,
        medicationId: medicationIds,
        quantityOnHand: { [Op.gt]: 0 },
        expiryDate: { [Op.gte]: saleDate },
        isActive: true,
      },
      order: [['expiryDate', 'ASC'], ['purchaseDate', 'ASC'], ['createdAt', 'ASC']],
      transaction: tx,
      lock: tx.LOCK.UPDATE,
    });
    const batchMap = new Map();
    batches.forEach((b) => {
      if (!batchMap.has(b.medicationId)) batchMap.set(b.medicationId, []);
      batchMap.get(b.medicationId).push(b);
    });

    const normalizedItems = items.map((rawItem) => {
      const medication = medMap.get(rawItem.medicationId);
      const quantity = Number(rawItem.quantity || 0);
      if (!quantity || quantity <= 0) throw new Error(`Invalid quantity for ${medication.name}`);
      if (!Number.isInteger(quantity)) throw new Error(`Quantity must be a whole number for ${medication.name}`);
      const totalStockQty = Number(medication.stockQuantity || 0);
      if (totalStockQty < quantity) {
        throw new Error(`Insufficient stock for ${medication.name}. Available ${totalStockQty}, requested ${quantity}`);
      }
      const availableBatches = batchMap.get(medication.id) || [];
      const availableQty = availableBatches.reduce((s, b) => s + Number(b.quantityOnHand || 0), 0);

      const unitPrice = Number(rawItem.unitPrice || medication.unitPrice || 0);
      const discountPct = Number(rawItem.discountPct || 0);
      const taxPct = Number(rawItem.taxPct || 0);

      const lineSubtotal = round2(quantity * unitPrice);
      const lineDiscount = round2((lineSubtotal * discountPct) / 100);
      const taxable = lineSubtotal - lineDiscount;
      const lineTax = round2((taxable * taxPct) / 100);
      const lineTotal = round2(taxable + lineTax);

      subtotal += lineSubtotal;
      discountAmount += lineDiscount;
      taxAmount += lineTax;

      const allocations = [];
      let remaining = quantity;
      for (const batch of availableBatches) {
        if (remaining <= 0) break;
        const canTake = Math.min(Number(batch.quantityOnHand || 0), remaining);
        if (canTake <= 0) continue;
        allocations.push({ batch, quantity: canTake });
        batch.quantityOnHand = Number(batch.quantityOnHand || 0) - canTake;
        remaining -= canTake;
      }
      // Legacy fallback: some old medicines may have stockQuantity without batch records.
      if (remaining > 0) {
        const legacyUnbatchedQty = Math.max(totalStockQty - availableQty, 0);
        if (legacyUnbatchedQty >= remaining) {
          allocations.push({ batch: null, quantity: remaining, legacy: true });
          remaining = 0;
        }
      }
      if (remaining > 0) {
        throw new Error(`Insufficient unexpired batch stock for ${medication.name}. Batch available ${availableQty}, requested ${quantity}`);
      }
      const firstBatch = allocations[0]?.batch || null;

      return {
        medication,
        allocations,
        payload: {
          medicationId: rawItem.medicationId,
          batchNo: rawItem.batchNo || firstBatch?.batchNo || null,
          expiryDate: rawItem.expiryDate || firstBatch?.expiryDate || null,
          quantity,
          unitPrice,
          discountPct,
          taxPct,
          lineSubtotal,
          lineDiscount,
          lineTax,
          lineTotal,
        },
      };
    });

    const totalAmount = round2(subtotal - discountAmount + taxAmount);

    const invoice = await MedicineInvoice.create({
      hospitalId,
      patientId: patientId || null,
      soldByUserId: req.user.id,
      invoiceDate: invoiceDate || new Date().toISOString().slice(0, 10),
      paymentMode,
      isPaid: Boolean(isPaid),
      notes: notes || null,
      subtotal: round2(subtotal),
      discountAmount: round2(discountAmount),
      taxAmount: round2(taxAmount),
      totalAmount,
    }, { transaction: tx });

    await MedicineInvoiceItem.bulkCreate(
      normalizedItems.map((x) => ({ ...x.payload, invoiceId: invoice.id })),
      { transaction: tx }
    );

    for (const item of normalizedItems) {
      const nextStock = Number(item.medication.stockQuantity) - Number(item.payload.quantity);
      await item.medication.update({ stockQuantity: nextStock }, { transaction: tx });
      for (const alloc of item.allocations || []) {
        if (alloc.batch) {
          await alloc.batch.update({
            quantityOnHand: Number(alloc.batch.quantityOnHand || 0),
          }, { transaction: tx });
        }
        await StockLedgerEntry.create({
          hospitalId,
          medicationId: item.payload.medicationId,
          batchId: alloc.batch?.id || null,
          entryDate: saleDate,
          entryType: 'sale',
          quantityIn: 0,
          quantityOut: Number(alloc.quantity || 0),
          balanceAfter: nextStock,
          referenceType: 'medicine_invoice',
          referenceId: invoice.id,
          notes: alloc.legacy
            ? `Invoice ${invoice.invoiceNumber} (legacy stock without batch)`
            : `Invoice ${invoice.invoiceNumber}`,
          createdByUserId: req.user.id,
        }, { transaction: tx });
      }
    }

    await tx.commit();

    const created = await MedicineInvoice.findByPk(invoice.id, {
      include: [
        { model: Patient, as: 'patient', attributes: ['id', 'name', 'patientId', 'phone'] },
        { model: User, as: 'soldBy', attributes: ['id', 'name', 'email'] },
        {
          model: MedicineInvoiceItem,
          as: 'items',
          include: [{ model: Medication, as: 'medication', attributes: ['id', 'name', 'category'] }],
        },
      ],
    });

    res.status(201).json(created);
  } catch (err) {
    await tx.rollback();
    res.status(400).json({ message: err.message || 'Failed to create medicine invoice' });
  }
};

exports.markPaid = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const invoice = await MedicineInvoice.findByPk(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    if (!isSuperAdmin(req.user) && invoice.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital invoice' });
    }

    await invoice.update({ isPaid: Boolean(req.body.isPaid) });
    res.json({ message: 'Payment status updated', invoice });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getGSTReport = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { from, to, gstRate } = req.query;

    const invoiceWhere = {};
    if (!isSuperAdmin(req.user)) invoiceWhere.hospitalId = scope.hospitalId;
    if (from && to) invoiceWhere.invoiceDate = { [Op.between]: [from, to] };
    else if (from) invoiceWhere.invoiceDate = { [Op.gte]: from };
    else if (to) invoiceWhere.invoiceDate = { [Op.lte]: to };

    const itemWhere = {};
    if (gstRate !== undefined && gstRate !== '') {
      itemWhere.taxPct = Number(gstRate);
    }

    const items = await MedicineInvoiceItem.findAll({
      where: itemWhere,
      include: [
        {
          model: MedicineInvoice,
          as: 'invoice',
          where: invoiceWhere,
          attributes: ['id', 'invoiceDate', 'isPaid', 'invoiceNumber'],
        },
        {
          model: Medication,
          as: 'medication',
          attributes: ['id', 'name', 'category', 'gstRate'],
        },
      ],
    });

    let totalTaxableAmount = 0;
    let totalGSTAmount = 0;

    const invoiceSet = new Set();
    const rateMap = new Map();
    const medMap = new Map();

    items.forEach((item) => {
      const taxPct = Number(item.taxPct || 0);
      const taxable = round2(Number(item.lineSubtotal || 0) - Number(item.lineDiscount || 0));
      const gstAmt = Number(item.lineTax || 0);
      const qty = Number(item.quantity || 0);

      totalTaxableAmount += taxable;
      totalGSTAmount += gstAmt;
      if (item.invoice?.id) invoiceSet.add(item.invoice.id);

      if (!rateMap.has(taxPct)) rateMap.set(taxPct, { gstRate: taxPct, invoiceIds: new Set(), taxableAmount: 0, gstAmount: 0 });
      const rateRec = rateMap.get(taxPct);
      rateRec.taxableAmount += taxable;
      rateRec.gstAmount += gstAmt;
      if (item.invoice?.id) rateRec.invoiceIds.add(item.invoice.id);

      const medName = item.medication?.name || 'Unknown';
      const medGst = Number(item.medication?.gstRate ?? taxPct);
      if (!medMap.has(medName)) medMap.set(medName, { name: medName, gstRate: medGst, qtySold: 0, taxableAmount: 0, gstAmount: 0 });
      const medRec = medMap.get(medName);
      medRec.qtySold += qty;
      medRec.taxableAmount += taxable;
      medRec.gstAmount += gstAmt;
    });

    const salesReturnWhere = {};
    if (!isSuperAdmin(req.user)) salesReturnWhere.hospitalId = scope.hospitalId;
    else if (req.query.hospitalId) salesReturnWhere.hospitalId = req.query.hospitalId;
    if (from && to) salesReturnWhere.returnDate = { [Op.between]: [from, to] };
    else if (from) salesReturnWhere.returnDate = { [Op.gte]: from };
    else if (to) salesReturnWhere.returnDate = { [Op.lte]: to };

    const salesReturnItems = await MedicineInvoiceReturnItem.findAll({
      include: [
        { model: MedicineInvoiceReturn, as: 'return', where: salesReturnWhere, attributes: ['id'] },
        { model: Medication, as: 'medication', attributes: ['id', 'name', 'category', 'gstRate'] },
      ],
    });

    salesReturnItems.forEach((item) => {
      const taxPct = Number(item.taxPct || 0);
      const taxable = round2(Number(item.lineSubtotal || 0));
      const gstAmt = Number(item.lineTax || 0);
      const qty = Number(item.quantity || 0);
      const medName = item.medication?.name || 'Unknown';

      totalTaxableAmount -= taxable;
      totalGSTAmount -= gstAmt;

      if (!rateMap.has(taxPct)) rateMap.set(taxPct, { gstRate: taxPct, invoiceIds: new Set(), taxableAmount: 0, gstAmount: 0 });
      const rateRec = rateMap.get(taxPct);
      rateRec.taxableAmount -= taxable;
      rateRec.gstAmount -= gstAmt;

      if (!medMap.has(medName)) medMap.set(medName, { name: medName, gstRate: Number(item.medication?.gstRate ?? taxPct), qtySold: 0, taxableAmount: 0, gstAmount: 0 });
      const medRec = medMap.get(medName);
      medRec.qtySold -= qty;
      medRec.taxableAmount -= taxable;
      medRec.gstAmount -= gstAmt;
    });

    const byRate = Array.from(rateMap.values())
      .map((r) => ({
        gstRate: r.gstRate,
        invoiceCount: r.invoiceIds.size,
        taxableAmount: round2(r.taxableAmount),
        gstAmount: round2(r.gstAmount),
      }))
      .sort((a, b) => a.gstRate - b.gstRate);

    const medicines = Array.from(medMap.values())
      .map((m) => ({ ...m, taxableAmount: round2(m.taxableAmount), gstAmount: round2(m.gstAmount) }))
      .sort((a, b) => b.gstAmount - a.gstAmount)
      .slice(0, 50);

    const purchaseWhere = {};
    if (!isSuperAdmin(req.user)) purchaseWhere.hospitalId = scope.hospitalId;
    else if (req.query.hospitalId) purchaseWhere.hospitalId = req.query.hospitalId;
    if (from && to) purchaseWhere.purchaseDate = { [Op.between]: [from, to] };
    else if (from) purchaseWhere.purchaseDate = { [Op.gte]: from };
    else if (to) purchaseWhere.purchaseDate = { [Op.lte]: to };
    if (gstRate !== undefined && gstRate !== '') purchaseWhere.taxPct = Number(gstRate);

    const purchases = await StockPurchase.findAll({
      where: purchaseWhere,
      include: [{ model: Medication, as: 'medication', attributes: ['id', 'name', 'category', 'gstRate'] }],
    });

    let inputTaxableAmount = 0;
    let inputGSTAmount = 0;
    const inputRateMap = new Map();
    const inputMedMap = new Map();

    purchases.forEach((p) => {
      const pct = Number(p.taxPct || 0);
      const taxable = Number(p.taxableAmount || 0);
      const gstAmt = Number(p.taxAmount || 0);
      const qty = Number(p.quantity || 0);
      const medName = p.medication?.name || 'Unknown';
      const medGst = Number(p.medication?.gstRate ?? pct);

      inputTaxableAmount += taxable;
      inputGSTAmount += gstAmt;

      if (!inputRateMap.has(pct)) inputRateMap.set(pct, { gstRate: pct, taxableAmount: 0, gstAmount: 0, purchaseCount: 0 });
      const rateRec = inputRateMap.get(pct);
      rateRec.taxableAmount += taxable;
      rateRec.gstAmount += gstAmt;
      rateRec.purchaseCount += 1;

      if (!inputMedMap.has(medName)) inputMedMap.set(medName, { name: medName, gstRate: medGst, qtyPurchased: 0, taxableAmount: 0, gstAmount: 0 });
      const medRec = inputMedMap.get(medName);
      medRec.qtyPurchased += qty;
      medRec.taxableAmount += taxable;
      medRec.gstAmount += gstAmt;
    });

    const purchaseReturnWhere = {};
    if (!isSuperAdmin(req.user)) purchaseReturnWhere.hospitalId = scope.hospitalId;
    else if (req.query.hospitalId) purchaseReturnWhere.hospitalId = req.query.hospitalId;
    if (from && to) purchaseReturnWhere.returnDate = { [Op.between]: [from, to] };
    else if (from) purchaseReturnWhere.returnDate = { [Op.gte]: from };
    else if (to) purchaseReturnWhere.returnDate = { [Op.lte]: to };
    if (gstRate !== undefined && gstRate !== '') purchaseReturnWhere.taxPct = Number(gstRate);

    const purchaseReturns = await StockPurchaseReturn.findAll({
      where: purchaseReturnWhere,
      include: [{ model: Medication, as: 'medication', attributes: ['id', 'name', 'category', 'gstRate'] }],
    });

    purchaseReturns.forEach((p) => {
      const pct = Number(p.taxPct || 0);
      const taxable = Number(p.taxableAmount || 0);
      const gstAmt = Number(p.taxAmount || 0);
      const qty = Number(p.quantity || 0);
      const medName = p.medication?.name || 'Unknown';
      const medGst = Number(p.medication?.gstRate ?? pct);

      inputTaxableAmount -= taxable;
      inputGSTAmount -= gstAmt;

      if (!inputRateMap.has(pct)) inputRateMap.set(pct, { gstRate: pct, taxableAmount: 0, gstAmount: 0, purchaseCount: 0 });
      const rateRec = inputRateMap.get(pct);
      rateRec.taxableAmount -= taxable;
      rateRec.gstAmount -= gstAmt;

      if (!inputMedMap.has(medName)) inputMedMap.set(medName, { name: medName, gstRate: medGst, qtyPurchased: 0, taxableAmount: 0, gstAmount: 0 });
      const medRec = inputMedMap.get(medName);
      medRec.qtyPurchased -= qty;
      medRec.taxableAmount -= taxable;
      medRec.gstAmount -= gstAmt;
    });

    const inputByRate = Array.from(inputRateMap.values())
      .map((r) => ({
        gstRate: r.gstRate,
        purchaseCount: r.purchaseCount,
        taxableAmount: round2(r.taxableAmount),
        gstAmount: round2(r.gstAmount),
      }))
      .sort((a, b) => a.gstRate - b.gstRate);

    const inputMedicines = Array.from(inputMedMap.values())
      .map((m) => ({ ...m, taxableAmount: round2(m.taxableAmount), gstAmount: round2(m.gstAmount) }))
      .filter((m) => m.taxableAmount !== 0 || m.gstAmount !== 0 || m.qtySold !== 0)
      .sort((a, b) => b.gstAmount - a.gstAmount)
      .slice(0, 50);

    const outputGST = round2(totalGSTAmount);
    const inputGST = round2(inputGSTAmount);
    const netTaxPayable = round2(outputGST - inputGST);

    const invoiceHeaders = await MedicineInvoice.findAll({
      where: invoiceWhere,
      attributes: ['id', 'subtotal', 'discountAmount', 'taxAmount', 'totalAmount'],
    });
    const returnHeaders = await MedicineInvoiceReturn.findAll({
      where: salesReturnWhere,
      attributes: ['id', 'subtotal', 'taxAmount', 'totalAmount'],
    });

    const invoiceHeaderTaxable = round2(invoiceHeaders.reduce(
      (s, x) => s + (Number(x.subtotal || 0) - Number(x.discountAmount || 0)),
      0
    ));
    const invoiceHeaderGst = round2(invoiceHeaders.reduce((s, x) => s + Number(x.taxAmount || 0), 0));
    const returnHeaderTaxable = round2(returnHeaders.reduce((s, x) => s + Number(x.subtotal || 0), 0));
    const returnHeaderGst = round2(returnHeaders.reduce((s, x) => s + Number(x.taxAmount || 0), 0));
    const returnItemsTaxable = round2(salesReturnItems.reduce((s, x) => s + Number(x.lineSubtotal || 0), 0));
    const returnItemsGst = round2(salesReturnItems.reduce((s, x) => s + Number(x.lineTax || 0), 0));

    const grossItemTaxable = round2(totalTaxableAmount + returnHeaderTaxable);
    const grossItemGst = round2(outputGST + returnHeaderGst);
    const outputByRateTaxable = round2(byRate.reduce((s, x) => s + Number(x.taxableAmount || 0), 0));
    const outputByRateGst = round2(byRate.reduce((s, x) => s + Number(x.gstAmount || 0), 0));
    const inputByRateTaxable = round2(inputByRate.reduce((s, x) => s + Number(x.taxableAmount || 0), 0));
    const inputByRateGst = round2(inputByRate.reduce((s, x) => s + Number(x.gstAmount || 0), 0));
    const netFormula = round2(outputGST - inputGST);

    const reconciliation = {
      tolerance: 0.5,
      salesItemsVsInvoiceHeaders: {
        itemTaxable: grossItemTaxable,
        headerTaxable: invoiceHeaderTaxable,
        diffTaxable: round2(grossItemTaxable - invoiceHeaderTaxable),
        itemGST: grossItemGst,
        headerGST: invoiceHeaderGst,
        diffGST: round2(grossItemGst - invoiceHeaderGst),
        isMatched:
          withinTolerance(grossItemTaxable, invoiceHeaderTaxable)
          && withinTolerance(grossItemGst, invoiceHeaderGst),
      },
      salesReturnsItemsVsReturnHeaders: {
        itemTaxable: returnItemsTaxable,
        headerTaxable: returnHeaderTaxable,
        diffTaxable: round2(returnItemsTaxable - returnHeaderTaxable),
        itemGST: returnItemsGst,
        headerGST: returnHeaderGst,
        diffGST: round2(returnItemsGst - returnHeaderGst),
        isMatched:
          withinTolerance(returnItemsTaxable, returnHeaderTaxable)
          && withinTolerance(returnItemsGst, returnHeaderGst),
      },
      outputByRateVsOutputTotals: {
        byRateTaxable: outputByRateTaxable,
        outputTaxable: round2(totalTaxableAmount),
        diffTaxable: round2(outputByRateTaxable - round2(totalTaxableAmount)),
        byRateGST: outputByRateGst,
        outputGST,
        diffGST: round2(outputByRateGst - outputGST),
        isMatched:
          withinTolerance(outputByRateTaxable, round2(totalTaxableAmount))
          && withinTolerance(outputByRateGst, outputGST),
      },
      inputByRateVsInputTotals: {
        byRateTaxable: inputByRateTaxable,
        inputTaxable: round2(inputTaxableAmount),
        diffTaxable: round2(inputByRateTaxable - round2(inputTaxableAmount)),
        byRateGST: inputByRateGst,
        inputGST,
        diffGST: round2(inputByRateGst - inputGST),
        isMatched:
          withinTolerance(inputByRateTaxable, round2(inputTaxableAmount))
          && withinTolerance(inputByRateGst, inputGST),
      },
      netFormulaCheck: {
        computedNet: netFormula,
        reportedNet: netTaxPayable,
        diff: round2(netFormula - netTaxPayable),
        isMatched: withinTolerance(netFormula, netTaxPayable),
      },
    };

    const warnings = [];
    if (!reconciliation.salesItemsVsInvoiceHeaders.isMatched) warnings.push('Sales item totals do not match invoice header totals.');
    if (!reconciliation.salesReturnsItemsVsReturnHeaders.isMatched) warnings.push('Sales return item totals do not match return header totals.');
    if (!reconciliation.outputByRateVsOutputTotals.isMatched) warnings.push('Output GST by-rate totals do not match output summary totals.');
    if (!reconciliation.inputByRateVsInputTotals.isMatched) warnings.push('Input GST by-rate totals do not match purchase summary totals.');
    if (!reconciliation.netFormulaCheck.isMatched) warnings.push('Net tax payable does not match output GST minus input GST formula.');

    res.json({
      summary: {
        totalInvoices: invoiceSet.size,
        totalTaxableAmount: round2(totalTaxableAmount),
        totalGSTAmount: outputGST,
        outputGSTAmount: outputGST,
        inputGSTAmount: inputGST,
        netTaxPayable,
        byRate,
      },
      reconciliation,
      warnings,
      medicines,
      purchases: {
        totalPurchases: purchases.length,
        totalPurchaseReturns: purchaseReturns.length,
        totalTaxableAmount: round2(inputTaxableAmount),
        totalGSTAmount: inputGST,
        byRate: inputByRate,
        medicines: inputMedicines,
      },
      range: { from: from || null, to: to || null },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAnalytics = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { from, to } = req.query;
    const where = {};

    if (!isSuperAdmin(req.user)) where.hospitalId = scope.hospitalId;
    if (from && to) where.invoiceDate = { [Op.between]: [from, to] };
    else if (from) where.invoiceDate = { [Op.gte]: from };
    else if (to) where.invoiceDate = { [Op.lte]: to };

    const invoices = await MedicineInvoice.findAll({
      where,
      include: [
        {
          model: MedicineInvoiceItem,
          as: 'items',
          include: [{ model: Medication, as: 'medication', attributes: ['id', 'name', 'category'] }],
        },
      ],
      order: [['invoiceDate', 'ASC']],
    });

    const returnsWhere = {};
    if (!isSuperAdmin(req.user)) returnsWhere.hospitalId = scope.hospitalId;
    applyDateRange(returnsWhere, 'returnDate', from, to);
    const returns = await MedicineInvoiceReturn.findAll({
      where: returnsWhere,
      include: [{ model: MedicineInvoice, as: 'invoice', attributes: ['id', 'isPaid', 'hospitalId'] }],
    });

    const totalInvoices = invoices.length;
    const grossTotalAmount = round2(invoices.reduce((sum, i) => sum + Number(i.totalAmount || 0), 0));
    const grossPaidAmount = round2(invoices.filter((i) => i.isPaid).reduce((sum, i) => sum + Number(i.totalAmount || 0), 0));
    const totalReturnsAmount = round2(returns.reduce((s, r) => s + Number(r.totalAmount || 0), 0));
    const returnsOnPaid = round2(returns.filter((r) => r.invoice?.isPaid).reduce((s, r) => s + Number(r.totalAmount || 0), 0));
    const totalAmount = round2(grossTotalAmount - totalReturnsAmount);
    const paidAmount = round2(grossPaidAmount - returnsOnPaid);
    const pendingAmount = round2(totalAmount - paidAmount);

    const dayMap = new Map();
    const categoryMap = new Map();
    const medicineMap = new Map();

    invoices.forEach((invoice) => {
      const day = invoice.invoiceDate;
      if (!dayMap.has(day)) {
        dayMap.set(day, { date: day, invoices: 0, amount: 0, paidAmount: 0, pendingAmount: 0 });
      }
      const dayRec = dayMap.get(day);
      const amount = Number(invoice.totalAmount || 0);
      dayRec.invoices += 1;
      dayRec.amount += amount;
      if (invoice.isPaid) dayRec.paidAmount += amount;
      else dayRec.pendingAmount += amount;

      (invoice.items || []).forEach((item) => {
        const cat = item.medication?.category || 'other';
        if (!categoryMap.has(cat)) categoryMap.set(cat, { category: cat, amount: 0, quantity: 0 });
        const catRec = categoryMap.get(cat);
        catRec.amount += Number(item.lineTotal || 0);
        catRec.quantity += Number(item.quantity || 0);

        const medName = item.medication?.name || 'Unknown';
        if (!medicineMap.has(medName)) medicineMap.set(medName, { name: medName, amount: 0, quantity: 0 });
        const medRec = medicineMap.get(medName);
        medRec.amount += Number(item.lineTotal || 0);
        medRec.quantity += Number(item.quantity || 0);
      });
    });

    const dayWise = Array.from(dayMap.values())
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-30)
      .map((x) => ({
        ...x,
        amount: round2(x.amount),
        paidAmount: round2(x.paidAmount),
        pendingAmount: round2(x.pendingAmount),
        label: new Date(x.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      }));

    const categoryWise = Array.from(categoryMap.values())
      .map((x) => ({ ...x, amount: round2(x.amount), quantity: round2(x.quantity) }))
      .sort((a, b) => b.amount - a.amount);

    const topMedicines = Array.from(medicineMap.values())
      .map((x) => ({ ...x, amount: round2(x.amount), quantity: round2(x.quantity) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    res.json({
      summary: {
        totalInvoices,
        totalReturns: returns.length,
        totalReturnsAmount,
        totalAmount,
        paidAmount,
        pendingAmount,
        collectionRate: totalAmount > 0 ? round2((paidAmount / totalAmount) * 100) : 0,
      },
      range: { from: from || null, to: to || null },
      dayWise,
      categoryWise,
      topMedicines,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getReturns = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const invoice = await MedicineInvoice.findByPk(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (!isSuperAdmin(req.user) && invoice.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital invoice' });
    }

    const returns = await MedicineInvoiceReturn.findAll({
      where: { invoiceId: invoice.id },
      include: [
        { model: User, as: 'createdBy', attributes: ['id', 'name', 'email'] },
        {
          model: MedicineInvoiceReturnItem,
          as: 'items',
          include: [{ model: Medication, as: 'medication', attributes: ['id', 'name', 'category'] }],
        },
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

    const invoice = await MedicineInvoice.findByPk(req.params.id, {
      transaction: tx,
      lock: tx.LOCK.UPDATE,
    });
    if (!invoice) {
      await tx.rollback();
      return res.status(404).json({ message: 'Invoice not found' });
    }
    if (!isSuperAdmin(req.user) && invoice.hospitalId !== scope.hospitalId) {
      await tx.rollback();
      return res.status(403).json({ message: 'Access denied for this hospital invoice' });
    }

    const { items = [], reason, notes, returnDate, requestId, clientTxnId } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      await tx.rollback();
      return res.status(400).json({ message: 'At least one return item is required' });
    }

    const returnRequestKey = parseRequestKey(requestId || clientTxnId);
    const requestTag = returnRequestKey ? `[return-request:${returnRequestKey}]` : '';

    const invoiceItems = await MedicineInvoiceItem.findAll({
      where: { invoiceId: invoice.id },
      include: [{ model: Medication, as: 'medication', attributes: ['id', 'name'] }],
      transaction: tx,
      lock: tx.LOCK.UPDATE,
    });

    const invoiceItemMap = new Map((invoiceItems || []).map((it) => [it.id, it]));
    const invoiceItemIds = items.map((x) => x.invoiceItemId).filter(Boolean);
    if (invoiceItemIds.length !== items.length) {
      await tx.rollback();
      return res.status(400).json({ message: 'invoiceItemId is required for each return item' });
    }
    const duplicateInvoiceItemId = invoiceItemIds.find((id, idx) => invoiceItemIds.indexOf(id) !== idx);
    if (duplicateInvoiceItemId) {
      await tx.rollback();
      return res.status(400).json({ message: `Duplicate invoiceItemId in return payload: ${duplicateInvoiceItemId}` });
    }

    if (requestTag) {
      const existingReturn = await MedicineInvoiceReturn.findOne({
        where: {
          invoiceId: invoice.id,
          notes: { [Op.iLike]: `%${requestTag}%` },
        },
        include: [
          { model: User, as: 'createdBy', attributes: ['id', 'name', 'email'] },
          {
            model: MedicineInvoiceReturnItem,
            as: 'items',
            include: [{ model: Medication, as: 'medication', attributes: ['id', 'name', 'category'] }],
          },
        ],
        transaction: tx,
      });
      if (existingReturn) {
        await tx.rollback();
        return res.status(200).json(existingReturn);
      }
    }

    const existingReturnItems = await MedicineInvoiceReturnItem.findAll({
      where: { invoiceItemId: invoiceItemIds },
      transaction: tx,
      include: [{ model: MedicineInvoiceReturn, as: 'return', attributes: ['id', 'invoiceId'] }],
    });
    const returnedQtyByItem = new Map();
    existingReturnItems.forEach((rit) => {
      if (rit.return?.invoiceId !== invoice.id) return;
      returnedQtyByItem.set(
        rit.invoiceItemId,
        Number(returnedQtyByItem.get(rit.invoiceItemId) || 0) + Number(rit.quantity || 0)
      );
    });

    let subtotal = 0;
    let taxAmount = 0;
    const normalizedItems = [];

    for (const raw of items) {
      const src = invoiceItemMap.get(raw.invoiceItemId);
      if (!src) {
        await tx.rollback();
        return res.status(400).json({ message: `Invalid invoiceItemId: ${raw.invoiceItemId}` });
      }

      const qty = Number(raw.quantity || 0);
      if (!Number.isFinite(qty) || qty <= 0) {
        await tx.rollback();
        return res.status(400).json({ message: 'Return quantity must be greater than 0' });
      }
      if (!Number.isInteger(qty)) {
        await tx.rollback();
        return res.status(400).json({ message: 'Return quantity must be a whole number' });
      }

      const soldQty = Number(src.quantity || 0);
      const alreadyReturned = Number(returnedQtyByItem.get(src.id) || 0);
      const maxReturnable = soldQty - alreadyReturned;
      if (qty > maxReturnable) {
        await tx.rollback();
        const medName = src.medication?.name || src.medicationId || src.id;
        return res.status(400).json({
          message: `Return exceeds remaining quantity for ${medName}. Sold ${soldQty}, already returned ${alreadyReturned}, remaining ${maxReturnable}, requested ${qty}`,
        });
      }

      const taxablePerUnit = soldQty > 0
        ? (Number(src.lineSubtotal || 0) - Number(src.lineDiscount || 0)) / soldQty
        : 0;
      const taxPerUnit = soldQty > 0 ? Number(src.lineTax || 0) / soldQty : 0;
      const lineSubtotal = round2(taxablePerUnit * qty);
      const lineTax = round2(taxPerUnit * qty);
      const lineTotal = round2(lineSubtotal + lineTax);

      subtotal += lineSubtotal;
      taxAmount += lineTax;
      normalizedItems.push({
        invoiceItemId: src.id,
        medicationId: src.medicationId,
        batchNo: src.batchNo || null,
        expiryDate: src.expiryDate || null,
        quantity: qty,
        unitPrice: round2(Number(src.unitPrice || 0)),
        taxPct: round2(Number(src.taxPct || 0)),
        lineSubtotal,
        lineTax,
        lineTotal,
      });
    }

    const totalAmount = round2(subtotal + taxAmount);

    const ret = await MedicineInvoiceReturn.create({
      hospitalId: invoice.hospitalId,
      invoiceId: invoice.id,
      createdByUserId: req.user.id,
      returnDate: returnDate || new Date().toISOString().slice(0, 10),
      reason: reason || null,
      notes: [notes, requestTag].filter(Boolean).join(' ').trim() || null,
      subtotal: round2(subtotal),
      taxAmount: round2(taxAmount),
      totalAmount,
    }, { transaction: tx });

    await MedicineInvoiceReturnItem.bulkCreate(
      normalizedItems.map((x) => ({ ...x, returnId: ret.id })),
      { transaction: tx }
    );

    for (const it of normalizedItems) {
      const med = await Medication.findByPk(it.medicationId, { transaction: tx, lock: tx.LOCK.UPDATE });
      if (!med) {
        await tx.rollback();
        return res.status(400).json({ message: 'Medication not found while processing return' });
      }
      const nextStock = Number(med.stockQuantity || 0) + Number(it.quantity || 0);
      await med.update({ stockQuantity: nextStock }, { transaction: tx });

      if (it.batchNo) {
        const b = await MedicationBatch.findOne({
          where: {
            hospitalId: invoice.hospitalId,
            medicationId: it.medicationId,
            batchNo: String(it.batchNo).trim().toUpperCase(),
          },
          transaction: tx,
          lock: tx.LOCK.UPDATE,
        });
        if (b) {
          await b.update({ quantityOnHand: Number(b.quantityOnHand || 0) + Number(it.quantity || 0) }, { transaction: tx });
        }
      }
      await StockLedgerEntry.create({
        hospitalId: invoice.hospitalId,
        medicationId: it.medicationId,
        batchId: null,
        entryDate: returnDate || new Date().toISOString().slice(0, 10),
        entryType: 'sales_return',
        quantityIn: Number(it.quantity || 0),
        quantityOut: 0,
        balanceAfter: nextStock,
        referenceType: 'medicine_invoice_return',
        referenceId: ret.id,
        notes: reason || notes || null,
        createdByUserId: req.user.id,
      }, { transaction: tx });
    }

    await tx.commit();

    const created = await MedicineInvoiceReturn.findByPk(ret.id, {
      include: [
        { model: User, as: 'createdBy', attributes: ['id', 'name', 'email'] },
        {
          model: MedicineInvoiceReturnItem,
          as: 'items',
          include: [{ model: Medication, as: 'medication', attributes: ['id', 'name', 'category'] }],
        },
      ],
    });
    res.status(201).json(created);
  } catch (err) {
    await tx.rollback();
    res.status(400).json({ message: err.message || 'Failed to create invoice return' });
  }
};

exports.getGSTR1 = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { from, to } = req.query;
    const where = {};
    if (!isSuperAdmin(req.user)) where.hospitalId = scope.hospitalId;
    else if (req.query.hospitalId) where.hospitalId = req.query.hospitalId;
    applyDateRange(where, 'invoiceDate', from, to);

    const invoices = await MedicineInvoice.findAll({
      where,
      include: [
        { model: Patient, as: 'patient', attributes: ['id', 'name', 'patientId', 'phone'] },
        {
          model: MedicineInvoiceItem,
          as: 'items',
          include: [{ model: Medication, as: 'medication', attributes: ['id', 'name', 'hsnCode', 'gstRate'] }],
        },
      ],
      order: [['invoiceDate', 'ASC'], ['createdAt', 'ASC']],
    });

    const outwardByRateMap = new Map();
    const hsnSummaryMap = new Map();

    invoices.forEach((inv) => {
      (inv.items || []).forEach((item) => {
        const rate = Number(item.taxPct || 0);
        const taxable = round2(Number(item.lineSubtotal || 0) - Number(item.lineDiscount || 0));
        const tax = round2(Number(item.lineTax || 0));
        const qty = Number(item.quantity || 0);
        const hsnCode = item.medication?.hsnCode || 'UNSPECIFIED';
        const medName = item.medication?.name || 'Unknown';

        if (!outwardByRateMap.has(rate)) {
          outwardByRateMap.set(rate, { rate, taxableValue: 0, taxAmount: 0, invoiceCount: 0, invoiceIds: new Set() });
        }
        const rec = outwardByRateMap.get(rate);
        rec.taxableValue += taxable;
        rec.taxAmount += tax;
        rec.invoiceIds.add(inv.id);
        rec.invoiceCount = rec.invoiceIds.size;

        const hsnKey = `${hsnCode}||${medName}||${rate}`;
        if (!hsnSummaryMap.has(hsnKey)) {
          hsnSummaryMap.set(hsnKey, { hsn: hsnCode, description: medName, uqc: 'NOS', totalQty: 0, taxableValue: 0, taxRate: rate, taxAmount: 0 });
        }
        const hsnRec = hsnSummaryMap.get(hsnKey);
        hsnRec.totalQty += qty;
        hsnRec.taxableValue += taxable;
        hsnRec.taxAmount += tax;
      });
    });

    const returnWhere = {};
    if (!isSuperAdmin(req.user)) returnWhere.hospitalId = scope.hospitalId;
    else if (req.query.hospitalId) returnWhere.hospitalId = req.query.hospitalId;
    applyDateRange(returnWhere, 'returnDate', from, to);

    const returnItems = await MedicineInvoiceReturnItem.findAll({
      include: [
        { model: MedicineInvoiceReturn, as: 'return', where: returnWhere, attributes: ['id', 'returnNumber', 'returnDate'] },
        { model: Medication, as: 'medication', attributes: ['id', 'name', 'hsnCode', 'gstRate'] },
      ],
    });

    const creditNotes = returnItems.map((it) => ({
      returnNumber: it.return?.returnNumber || null,
      returnDate: it.return?.returnDate || null,
      medicationName: it.medication?.name || 'Unknown',
      quantity: Number(it.quantity || 0),
      taxableValue: round2(Number(it.lineSubtotal || 0)),
      taxAmount: round2(Number(it.lineTax || 0)),
      totalValue: round2(Number(it.lineTotal || 0)),
      taxRate: Number(it.taxPct || 0),
    }));

    returnItems.forEach((item) => {
      const rate = Number(item.taxPct || 0);
      const taxable = round2(Number(item.lineSubtotal || 0));
      const tax = round2(Number(item.lineTax || 0));
      const qty = Number(item.quantity || 0);
      const hsnCode = item.medication?.hsnCode || 'UNSPECIFIED';
      const medName = item.medication?.name || 'Unknown';

      if (!outwardByRateMap.has(rate)) {
        outwardByRateMap.set(rate, { rate, taxableValue: 0, taxAmount: 0, invoiceCount: 0, invoiceIds: new Set() });
      }
      const rec = outwardByRateMap.get(rate);
      rec.taxableValue -= taxable;
      rec.taxAmount -= tax;

      const hsnKey = `${hsnCode}||${medName}||${rate}`;
      if (!hsnSummaryMap.has(hsnKey)) {
        hsnSummaryMap.set(hsnKey, { hsn: hsnCode, description: medName, uqc: 'NOS', totalQty: 0, taxableValue: 0, taxRate: rate, taxAmount: 0 });
      }
      const hsnRec = hsnSummaryMap.get(hsnKey);
      hsnRec.totalQty -= qty;
      hsnRec.taxableValue -= taxable;
      hsnRec.taxAmount -= tax;
    });

    const outwardByRate = Array.from(outwardByRateMap.values())
      .map((r) => ({
        rate: r.rate,
        invoiceCount: r.invoiceCount,
        taxableValue: round2(r.taxableValue),
        taxAmount: round2(r.taxAmount),
      }))
      .sort((a, b) => a.rate - b.rate);

    const hsnSummary = Array.from(hsnSummaryMap.values())
      .map((h) => ({
        ...h,
        totalQty: round2(h.totalQty),
        taxableValue: round2(h.taxableValue),
        taxAmount: round2(h.taxAmount),
      }))
      .sort((a, b) => b.taxAmount - a.taxAmount);

    const invoiceRows = invoices.map((inv) => ({
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.invoiceDate,
      recipientName: inv.patient?.name || 'Walk-in',
      recipientId: inv.patient?.patientId || null,
      taxableValue: round2(Number(inv.subtotal || 0) - Number(inv.discountAmount || 0)),
      taxAmount: round2(Number(inv.taxAmount || 0)),
      totalValue: round2(Number(inv.totalAmount || 0)),
      itemCount: (inv.items || []).length,
    }));

    const totalTaxableValue = round2(outwardByRate.reduce((s, r) => s + Number(r.taxableValue || 0), 0));
    const totalTaxAmount = round2(outwardByRate.reduce((s, r) => s + Number(r.taxAmount || 0), 0));

    res.json({
      returnType: 'GSTR-1',
      generatedAt: new Date().toISOString(),
      period: { from: from || null, to: to || null },
      summary: {
        totalInvoices: invoices.length,
        totalCreditNotes: creditNotes.length,
        totalTaxableValue,
        totalTaxAmount,
      },
      outwardByRate,
      invoiceRows,
      creditNotes,
      hsnSummary,
      notes: [
        'This is a system-generated draft summary for GSTR-1 preparation.',
        'Validate data with your CA before filing.',
      ],
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getGSTR3B = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { from, to } = req.query;

    const salesWhere = {};
    if (!isSuperAdmin(req.user)) salesWhere.hospitalId = scope.hospitalId;
    else if (req.query.hospitalId) salesWhere.hospitalId = req.query.hospitalId;
    applyDateRange(salesWhere, 'invoiceDate', from, to);

    const purchaseWhere = {};
    if (!isSuperAdmin(req.user)) purchaseWhere.hospitalId = scope.hospitalId;
    else if (req.query.hospitalId) purchaseWhere.hospitalId = req.query.hospitalId;
    applyDateRange(purchaseWhere, 'purchaseDate', from, to);

    const salesItems = await MedicineInvoiceItem.findAll({
      include: [{ model: MedicineInvoice, as: 'invoice', where: salesWhere, attributes: ['id'] }],
    });
    const purchases = await StockPurchase.findAll({ where: purchaseWhere });

    const outwardByRateMap = new Map();
    let outwardTaxable = 0;
    let outwardTax = 0;
    salesItems.forEach((item) => {
      const rate = Number(item.taxPct || 0);
      const taxable = round2(Number(item.lineSubtotal || 0) - Number(item.lineDiscount || 0));
      const tax = round2(Number(item.lineTax || 0));
      outwardTaxable += taxable;
      outwardTax += tax;
      if (!outwardByRateMap.has(rate)) outwardByRateMap.set(rate, { rate, taxableValue: 0, taxAmount: 0 });
      const r = outwardByRateMap.get(rate);
      r.taxableValue += taxable;
      r.taxAmount += tax;
    });

    const salesReturnWhere = {};
    if (!isSuperAdmin(req.user)) salesReturnWhere.hospitalId = scope.hospitalId;
    else if (req.query.hospitalId) salesReturnWhere.hospitalId = req.query.hospitalId;
    applyDateRange(salesReturnWhere, 'returnDate', from, to);

    const salesReturnItems = await MedicineInvoiceReturnItem.findAll({
      include: [{ model: MedicineInvoiceReturn, as: 'return', where: salesReturnWhere, attributes: ['id'] }],
    });
    salesReturnItems.forEach((item) => {
      const rate = Number(item.taxPct || 0);
      const taxable = round2(Number(item.lineSubtotal || 0));
      const tax = round2(Number(item.lineTax || 0));
      outwardTaxable -= taxable;
      outwardTax -= tax;
      if (!outwardByRateMap.has(rate)) outwardByRateMap.set(rate, { rate, taxableValue: 0, taxAmount: 0 });
      const r = outwardByRateMap.get(rate);
      r.taxableValue -= taxable;
      r.taxAmount -= tax;
    });

    const inwardByRateMap = new Map();
    let inwardTaxable = 0;
    let itcTax = 0;
    purchases.forEach((p) => {
      const rate = Number(p.taxPct || 0);
      const taxable = round2(Number(p.taxableAmount || 0));
      const tax = round2(Number(p.taxAmount || 0));
      inwardTaxable += taxable;
      itcTax += tax;
      if (!inwardByRateMap.has(rate)) inwardByRateMap.set(rate, { rate, taxableValue: 0, taxAmount: 0 });
      const r = inwardByRateMap.get(rate);
      r.taxableValue += taxable;
      r.taxAmount += tax;
    });

    const outwardByRate = Array.from(outwardByRateMap.values())
      .map((r) => ({ ...r, taxableValue: round2(r.taxableValue), taxAmount: round2(r.taxAmount) }))
      .sort((a, b) => a.rate - b.rate);
    const inwardByRate = Array.from(inwardByRateMap.values())
      .map((r) => ({ ...r, taxableValue: round2(r.taxableValue), taxAmount: round2(r.taxAmount) }))
      .sort((a, b) => a.rate - b.rate);

    const netTaxPayable = round2(outwardTax - itcTax);

    res.json({
      returnType: 'GSTR-3B',
      generatedAt: new Date().toISOString(),
      period: { from: from || null, to: to || null },
      outwardSupplies: {
        taxableValue: round2(outwardTaxable),
        taxAmount: round2(outwardTax),
        byRate: outwardByRate,
      },
      inwardSupplies: {
        taxableValue: round2(inwardTaxable),
        inputTaxCredit: round2(itcTax),
        byRate: inwardByRate,
      },
      liability: {
        outputTax: round2(outwardTax),
        inputTaxCredit: round2(itcTax),
        netTaxPayable,
      },
      adjustments: {
        salesReturnsCount: salesReturnItems.length,
        salesReturnsTaxableValue: round2(salesReturnItems.reduce((s, i) => s + Number(i.lineSubtotal || 0), 0)),
        salesReturnsTaxAmount: round2(salesReturnItems.reduce((s, i) => s + Number(i.lineTax || 0), 0)),
      },
      notes: [
        'This is a draft GSTR-3B support report.',
        'Use CA-reviewed figures for statutory filing.',
      ],
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getMargGstExport = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { from, to } = req.query;
    const where = {};
    if (!isSuperAdmin(req.user)) where.hospitalId = scope.hospitalId;
    else if (req.query.hospitalId) where.hospitalId = req.query.hospitalId;
    applyDateRange(where, 'invoiceDate', from, to);

    const invoices = await MedicineInvoice.findAll({
      where,
      include: [
        { model: Patient, as: 'patient', attributes: ['id', 'name', 'patientId', 'phone'] },
        {
          model: MedicineInvoiceItem,
          as: 'items',
          include: [{ model: Medication, as: 'medication', attributes: ['id', 'name', 'hsnCode', 'gstRate'] }],
        },
      ],
      order: [['invoiceDate', 'ASC'], ['createdAt', 'ASC']],
    });

    const esc = (value) => {
      const str = value === null || value === undefined ? '' : String(value);
      return `"${str.replace(/"/g, '""')}"`;
    };
    const safeDate = (value) => (value ? String(value).slice(0, 10) : '');

    const header = [
      'InvoiceNumber',
      'InvoiceDate',
      'PatientName',
      'PatientId',
      'PatientPhone',
      'ItemName',
      'HSNCode',
      'BatchNo',
      'ExpiryDate',
      'Quantity',
      'UnitPrice',
      'TaxableValue',
      'GSTRate',
      'CGSTRate',
      'CGSTAmount',
      'SGSTRate',
      'SGSTAmount',
      'IGSTRate',
      'IGSTAmount',
      'LineTotal',
      'PaymentMode',
      'IsPaid',
    ];

    const lines = [header.map(esc).join(',')];
    invoices.forEach((invoice) => {
      (invoice.items || []).forEach((item) => {
        const gstRate = Number(item.taxPct || 0);
        const taxableValue = round2(Number(item.lineSubtotal || 0) - Number(item.lineDiscount || 0));
        const gstAmount = round2(Number(item.lineTax || 0));
        const cgstRate = round2(gstRate / 2);
        const sgstRate = round2(gstRate / 2);
        const cgstAmount = round2(gstAmount / 2);
        const sgstAmount = round2(gstAmount / 2);
        const igstRate = 0;
        const igstAmount = 0;

        const row = [
          invoice.invoiceNumber || '',
          safeDate(invoice.invoiceDate),
          invoice.patient?.name || 'Walk-in',
          invoice.patient?.patientId || '',
          invoice.patient?.phone || '',
          item.medication?.name || 'Unknown',
          item.medication?.hsnCode || '',
          item.batchNo || '',
          safeDate(item.expiryDate),
          Number(item.quantity || 0),
          round2(Number(item.unitPrice || 0)),
          taxableValue,
          gstRate,
          cgstRate,
          cgstAmount,
          sgstRate,
          sgstAmount,
          igstRate,
          igstAmount,
          round2(Number(item.lineTotal || 0)),
          invoice.paymentMode || 'cash',
          invoice.isPaid ? 'Yes' : 'No',
        ];
        lines.push(row.map(esc).join(','));
      });
    });

    const fileName = `marg-gst-export-${from || 'start'}-to-${to || 'end'}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.status(200).send(lines.join('\n'));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
