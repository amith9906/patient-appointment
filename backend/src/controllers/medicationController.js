const { sequelize, Medication, MedicationBatch, StockLedgerEntry, Hospital } = require('../models');
const { Op } = require('sequelize');
const { ensureScopedHospital, isSuperAdmin } = require('../utils/accessScope');
const { getPaginationParams, buildPaginationMeta, applyPaginationOptions } = require('../utils/pagination');
const round2 = (n) => Number(Number(n || 0).toFixed(2));

exports.getAll = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { hospitalId, category, search, lowStock, stockStatus } = req.query;
    const where = { isActive: true };
    if (isSuperAdmin(req.user)) {
      if (hospitalId) where.hospitalId = hospitalId;
    } else {
      where.hospitalId = scope.hospitalId;
    }
    if (category) where.category = category;
    if (lowStock === 'true') where.stockQuantity = { [Op.lt]: 10 };
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { genericName: { [Op.iLike]: `%${search}%` } },
      ];
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const threshold = new Date(today);
    threshold.setDate(threshold.getDate() + 30);
    const todayStr = today.toISOString().split('T')[0];
    const thresholdStr = threshold.toISOString().split('T')[0];
    if (stockStatus === 'expired') {
      where.expiryDate = { [Op.lt]: todayStr };
    } else if (stockStatus === 'expiring') {
      where.expiryDate = { [Op.gte]: todayStr, [Op.lte]: thresholdStr };
    }
      const pagination = getPaginationParams(req, { defaultPerPage: 25, forcePaginate: req.query.paginate !== 'false' });
      const baseOptions = {
        where,
        include: [{ model: Hospital, as: 'hospital', attributes: ['id', 'name'] }],
        order: [['createdAt', 'DESC']],
      };
      if (pagination) {
        const queryOptions = applyPaginationOptions(baseOptions, pagination, { forceDistinct: true });
        const medications = await Medication.findAndCountAll(queryOptions);
        return res.json({
          data: medications.rows,
          meta: buildPaginationMeta(pagination, medications.count),
        });
      }
      const medications = await Medication.findAll(baseOptions);
      res.json(medications);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getOne = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const med = await Medication.findByPk(req.params.id, {
      include: [{ model: Hospital, as: 'hospital', attributes: ['id', 'name'] }],
    });
    if (!med) return res.status(404).json({ message: 'Medication not found' });
    if (!isSuperAdmin(req.user) && med.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital medication' });
    }
    res.json(med);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.create = async (req, res) => {
  const tx = await sequelize.transaction();
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) {
      await tx.rollback();
      return;
    }

    const payload = { ...req.body };
    if (!isSuperAdmin(req.user)) payload.hospitalId = scope.hospitalId;
    if (!payload.hospitalId) {
      await tx.rollback();
      return res.status(400).json({ message: 'hospitalId is required' });
    }

    const openingQty = Number(payload.stockQuantity || 0);
    if (!Number.isInteger(openingQty) || openingQty < 0) {
      await tx.rollback();
      return res.status(400).json({ message: 'stockQuantity must be a whole number (0 or more)' });
    }
    payload.stockQuantity = openingQty;

    const med = await Medication.create(payload, { transaction: tx });

    if (openingQty > 0) {
      const batchNoRaw = String(req.body.batchNo || `OPEN-${med.id.slice(0, 8)}`).trim();
      const batchNo = batchNoRaw.toUpperCase();
      const entryDate = new Date().toISOString().slice(0, 10);
      const effectiveExpiry = req.body.expiryDate || med.expiryDate || '2099-12-31';
      const unitCost = Number(med.purchasePrice || med.unitPrice || 0);

      const batch = await MedicationBatch.create({
        hospitalId: med.hospitalId,
        medicationId: med.id,
        batchNo,
        mfgDate: req.body.mfgDate || null,
        expiryDate: effectiveExpiry,
        purchaseDate: entryDate,
        quantityOnHand: openingQty,
        unitCost: Number.isFinite(unitCost) ? Number(unitCost.toFixed(2)) : 0,
        notes: 'Opening stock on medication creation',
      }, { transaction: tx });

      await StockLedgerEntry.create({
        hospitalId: med.hospitalId,
        medicationId: med.id,
        batchId: batch.id,
        entryDate,
        entryType: 'opening',
        quantityIn: openingQty,
        quantityOut: 0,
        balanceAfter: openingQty,
        referenceType: 'medication_opening_stock',
        referenceId: med.id,
        notes: 'Opening stock on medication creation',
        createdByUserId: req.user.id,
      }, { transaction: tx });
    }

    await tx.commit();
    res.status(201).json(med);
  } catch (err) {
    await tx.rollback();
    res.status(400).json({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const med = await Medication.findByPk(req.params.id);
    if (!med) return res.status(404).json({ message: 'Medication not found' });
    if (!isSuperAdmin(req.user) && med.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital medication' });
    }

    const payload = { ...req.body };
    if (!isSuperAdmin(req.user)) delete payload.hospitalId;
    await med.update(payload);
    res.json(med);
  } catch (err) { res.status(400).json({ message: err.message }); }
};

exports.delete = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const med = await Medication.findByPk(req.params.id);
    if (!med) return res.status(404).json({ message: 'Medication not found' });
    if (!isSuperAdmin(req.user) && med.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital medication' });
    }
    await med.update({ isActive: false });
    res.json({ message: 'Medication deactivated' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getExpiryAlerts = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { days = 30, category, hospitalId } = req.query;
    const threshold = parseInt(days, 10) || 30;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const future = new Date(today);
    future.setDate(future.getDate() + threshold);

    const where = {
      isActive: true,
      expiryDate: { [Op.lte]: future.toISOString().slice(0, 10) },
    };
    if (category) where.category = category;
    if (isSuperAdmin(req.user)) {
      if (hospitalId) where.hospitalId = hospitalId;
    } else {
      where.hospitalId = scope.hospitalId;
    }

    const medications = await Medication.findAll({
      where,
      include: [{ model: Hospital, as: 'hospital', attributes: ['id', 'name'] }],
      order: [['expiryDate', 'ASC']],
    });

    const todayStr = today.toISOString().slice(0, 10);
    const result = medications.map((m) => {
      const expDate = m.expiryDate ? new Date(m.expiryDate + 'T00:00:00') : null;
      const daysRemaining = expDate
        ? Math.floor((expDate - today) / (1000 * 60 * 60 * 24))
        : null;
      return { ...m.toJSON(), daysRemaining };
    });

    res.json(result);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getAdvancedAnalytics = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const hospitalId = isSuperAdmin(req.user)
      ? (req.query.hospitalId || null)
      : scope.hospitalId;
    if (!hospitalId) return res.status(400).json({ message: 'hospitalId is required for super admin' });

    const lookbackDays = Math.max(1, Number(req.query.lookbackDays || 90));
    const deadStockDays = Math.max(1, Number(req.query.deadStockDays || 45));
    const expiryDays = Math.max(1, Number(req.query.expiryDays || 60));
    const fastMoverThreshold = Math.max(1, Number(req.query.fastMoverQty || 30));

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const lookbackFrom = new Date(today);
    lookbackFrom.setDate(today.getDate() - lookbackDays);
    const deadStockFrom = new Date(today);
    deadStockFrom.setDate(today.getDate() - deadStockDays);
    const expiryTill = new Date(today);
    expiryTill.setDate(today.getDate() + expiryDays);

    const medications = await Medication.findAll({
      where: { hospitalId, isActive: true },
      order: [['name', 'ASC']],
    });
    const medIds = medications.map((m) => m.id);
    if (!medIds.length) {
      return res.json({
        summary: {
          medicationCount: 0,
          totalStockValue: 0,
          deadStockCount: 0,
          expiryRiskCount: 0,
          nearExpiryValue: 0,
          fastMoverCount: 0,
          slowMoverCount: 0,
        },
        deadStock: [],
        expiryRisk: [],
        fastMovers: [],
        slowMovers: [],
      });
    }

    const [recentLedger, deadWindowSales, expiryBatches] = await Promise.all([
      StockLedgerEntry.findAll({
        where: {
          hospitalId,
          medicationId: { [Op.in]: medIds },
          entryDate: { [Op.gte]: lookbackFrom.toISOString().slice(0, 10) },
        },
        attributes: ['medicationId', 'entryType', 'quantityIn', 'quantityOut', 'entryDate'],
        order: [['entryDate', 'DESC']],
      }),
      StockLedgerEntry.findAll({
        where: {
          hospitalId,
          medicationId: { [Op.in]: medIds },
          entryDate: { [Op.gte]: deadStockFrom.toISOString().slice(0, 10) },
          entryType: { [Op.in]: ['sale', 'sales_return'] },
        },
        attributes: ['medicationId', 'entryType', 'quantityIn', 'quantityOut'],
      }),
      MedicationBatch.findAll({
        where: {
          hospitalId,
          medicationId: { [Op.in]: medIds },
          quantityOnHand: { [Op.gt]: 0 },
          expiryDate: { [Op.lte]: expiryTill.toISOString().slice(0, 10) },
        },
        attributes: ['id', 'medicationId', 'batchNo', 'expiryDate', 'quantityOnHand', 'unitCost'],
        order: [['expiryDate', 'ASC']],
      }),
    ]);

    const movementMap = new Map();
    recentLedger.forEach((e) => {
      const key = e.medicationId;
      if (!movementMap.has(key)) {
        movementMap.set(key, {
          soldQty: 0,
          returnedQty: 0,
          netSoldQty: 0,
          lastMovementDate: null,
        });
      }
      const rec = movementMap.get(key);
      if (!rec.lastMovementDate || String(e.entryDate) > rec.lastMovementDate) rec.lastMovementDate = String(e.entryDate);
      if (e.entryType === 'sale') rec.soldQty += Number(e.quantityOut || 0);
      if (e.entryType === 'sales_return') rec.returnedQty += Number(e.quantityIn || 0);
      rec.netSoldQty = rec.soldQty - rec.returnedQty;
    });

    const deadSaleSet = new Set();
    deadWindowSales.forEach((e) => {
      if (e.entryType === 'sale' && Number(e.quantityOut || 0) > 0) deadSaleSet.add(e.medicationId);
    });

    const expiryMap = new Map();
    expiryBatches.forEach((b) => {
      if (!expiryMap.has(b.medicationId)) expiryMap.set(b.medicationId, []);
      expiryMap.get(b.medicationId).push(b);
    });

    const deadStock = [];
    const expiryRisk = [];
    const fastMovers = [];
    const slowMovers = [];
    const monthlyMap = new Map();

    let totalStockValue = 0;
    let nearExpiryValue = 0;

    medications.forEach((m) => {
      const stockQty = Number(m.stockQuantity || 0);
      const unitPrice = Number(m.unitPrice || 0);
      const stockValue = round2(stockQty * unitPrice);
      totalStockValue += stockValue;

      const mov = movementMap.get(m.id) || { soldQty: 0, returnedQty: 0, netSoldQty: 0, lastMovementDate: null };
      const velocityPer30 = lookbackDays > 0 ? round2((Number(mov.netSoldQty || 0) / lookbackDays) * 30) : 0;
      const daysOfCover = velocityPer30 > 0 ? round2((stockQty / velocityPer30) * 30) : null;

      if (stockQty > 0 && !deadSaleSet.has(m.id)) {
        deadStock.push({
          id: m.id,
          name: m.name,
          category: m.category,
          stockQuantity: stockQty,
          stockValue,
          lastMovementDate: mov.lastMovementDate,
        });
      }

      const near = expiryMap.get(m.id) || [];
      if (near.length > 0) {
        const nearQty = near.reduce((s, x) => s + Number(x.quantityOnHand || 0), 0);
        const nearValue = round2(near.reduce((s, x) => s + (Number(x.quantityOnHand || 0) * Number(x.unitCost || unitPrice || 0)), 0));
        nearExpiryValue += nearValue;
        expiryRisk.push({
          id: m.id,
          name: m.name,
          stockQuantity: stockQty,
          nearExpiryQty: nearQty,
          nearExpiryValue: nearValue,
          nearestExpiryDate: near[0].expiryDate,
          batches: near.map((b) => ({ batchNo: b.batchNo, expiryDate: b.expiryDate, quantityOnHand: b.quantityOnHand })),
        });
      }

      const row = {
        id: m.id,
        name: m.name,
        category: m.category,
        stockQuantity: stockQty,
        stockValue,
        netSoldQty: Number(mov.netSoldQty || 0),
        velocityPer30Days: velocityPer30,
        daysOfCover,
      };
      if (row.netSoldQty >= fastMoverThreshold) fastMovers.push(row);
      if (stockQty > 0 && row.netSoldQty <= 1) slowMovers.push(row);
    });

    recentLedger.forEach((e) => {
      const d = String(e.entryDate || '');
      const month = d.slice(0, 7);
      if (!month) return;
      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, {
          month,
          purchaseQty: 0,
          saleQty: 0,
          purchaseReturnQty: 0,
          salesReturnQty: 0,
          netSaleQty: 0,
        });
      }
      const rec = monthlyMap.get(month);
      if (e.entryType === 'purchase') rec.purchaseQty += Number(e.quantityIn || 0);
      if (e.entryType === 'sale') rec.saleQty += Number(e.quantityOut || 0);
      if (e.entryType === 'purchase_return') rec.purchaseReturnQty += Number(e.quantityOut || 0);
      if (e.entryType === 'sales_return') rec.salesReturnQty += Number(e.quantityIn || 0);
      rec.netSaleQty = rec.saleQty - rec.salesReturnQty;
    });

    const monthlyMovement = Array.from(monthlyMap.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12)
      .map((r) => ({
        ...r,
        label: new Date(`${r.month}-01T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      }));

    deadStock.sort((a, b) => b.stockValue - a.stockValue);
    expiryRisk.sort((a, b) => String(a.nearestExpiryDate || '').localeCompare(String(b.nearestExpiryDate || '')));
    fastMovers.sort((a, b) => b.netSoldQty - a.netSoldQty);
    slowMovers.sort((a, b) => b.stockValue - a.stockValue);

    res.json({
      summary: {
        medicationCount: medications.length,
        totalStockValue: round2(totalStockValue),
        deadStockCount: deadStock.length,
        expiryRiskCount: expiryRisk.length,
        nearExpiryValue: round2(nearExpiryValue),
        fastMoverCount: fastMovers.length,
        slowMoverCount: slowMovers.length,
      },
      deadStock: deadStock.slice(0, 100),
      expiryRisk: expiryRisk.slice(0, 100),
      fastMovers: fastMovers.slice(0, 100),
      slowMovers: slowMovers.slice(0, 100),
      monthlyMovement,
      params: { lookbackDays, deadStockDays, expiryDays, fastMoverThreshold, asOfDate: todayStr },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getBatches = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const med = await Medication.findByPk(req.params.id);
    if (!med) return res.status(404).json({ message: 'Medication not found' });
    if (!isSuperAdmin(req.user) && med.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital medication' });
    }

    const includeExpired = req.query.includeExpired === 'true';
    const today = new Date().toISOString().slice(0, 10);
    const where = {
      hospitalId: med.hospitalId,
      medicationId: med.id,
      quantityOnHand: { [Op.gt]: 0 },
      ...(includeExpired ? {} : { expiryDate: { [Op.gte]: today } }),
    };
    const batches = await MedicationBatch.findAll({
      where,
      order: [['expiryDate', 'ASC'], ['purchaseDate', 'ASC'], ['createdAt', 'ASC']],
    });
    res.json(batches);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getStockLedger = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const med = await Medication.findByPk(req.params.id);
    if (!med) return res.status(404).json({ message: 'Medication not found' });
    if (!isSuperAdmin(req.user) && med.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital medication' });
    }

    const where = { hospitalId: med.hospitalId, medicationId: med.id };
    if (req.query.from && req.query.to) where.entryDate = { [Op.between]: [req.query.from, req.query.to] };
    else if (req.query.from) where.entryDate = { [Op.gte]: req.query.from };
    else if (req.query.to) where.entryDate = { [Op.lte]: req.query.to };

    const entries = await StockLedgerEntry.findAll({
      where,
      include: [{ model: MedicationBatch, as: 'batch', attributes: ['id', 'batchNo', 'expiryDate'] }],
      order: [['entryDate', 'DESC'], ['createdAt', 'DESC']],
      limit: Number(req.query.limit || 300),
    });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateStock = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { quantity, operation } = req.body; // operation: 'add' | 'subtract'
    const med = await Medication.findByPk(req.params.id);
    if (!med) return res.status(404).json({ message: 'Medication not found' });
    if (!isSuperAdmin(req.user) && med.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital medication' });
    }

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty)) {
      return res.status(400).json({ message: 'Quantity must be a positive whole number' });
    }
    if (!['add', 'subtract'].includes(operation)) {
      return res.status(400).json({ message: 'Invalid operation. Use add or subtract' });
    }

    const newQty = operation === 'subtract'
      ? Number(med.stockQuantity) - qty
      : Number(med.stockQuantity) + qty;

    if (newQty < 0) return res.status(400).json({ message: 'Insufficient stock' });
    await med.update({ stockQuantity: newQty });
    await StockLedgerEntry.create({
      hospitalId: med.hospitalId,
      medicationId: med.id,
      batchId: null,
      entryDate: new Date().toISOString().slice(0, 10),
      entryType: operation === 'add' ? 'manual_add' : 'manual_subtract',
      quantityIn: operation === 'add' ? qty : 0,
      quantityOut: operation === 'subtract' ? qty : 0,
      balanceAfter: newQty,
      referenceType: 'manual_stock_adjustment',
      referenceId: null,
      notes: req.body.notes || null,
      createdByUserId: req.user.id,
    });
    res.json({ message: 'Stock updated', stockQuantity: newQty });
  } catch (err) { res.status(500).json({ message: err.message }); }
};
