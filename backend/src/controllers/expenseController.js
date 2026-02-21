const { Expense } = require('../models');
const { Op } = require('sequelize');
const { ensureScopedHospital, isSuperAdmin } = require('../utils/accessScope');

exports.getAll = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { category, from, to } = req.query;
    const where = {};
    if (!isSuperAdmin(req.user)) where.hospitalId = scope.hospitalId;
    if (category) where.category = category;
    if (from || to) {
      where.date = {};
      if (from) where.date[Op.gte] = from;
      if (to) where.date[Op.lte] = to;
    }

    const expenses = await Expense.findAll({ where, order: [['date', 'DESC']] });
    res.json(expenses);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.create = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const expense = await Expense.create({
      ...req.body,
      hospitalId: isSuperAdmin(req.user) ? req.body.hospitalId : scope.hospitalId,
    });
    res.status(201).json(expense);
  } catch (err) { res.status(400).json({ message: err.message }); }
};

exports.update = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const expense = await Expense.findByPk(req.params.id);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });
    if (!isSuperAdmin(req.user) && expense.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital expense' });
    }

    const payload = { ...req.body };
    if (!isSuperAdmin(req.user)) delete payload.hospitalId;
    await expense.update(payload);
    res.json(expense);
  } catch (err) { res.status(400).json({ message: err.message }); }
};

exports.delete = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const expense = await Expense.findByPk(req.params.id);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });
    if (!isSuperAdmin(req.user) && expense.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital expense' });
    }
    await expense.destroy();
    res.json({ message: 'Expense deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getAnalytics = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { from, to } = req.query;
    const where = {};
    if (!isSuperAdmin(req.user)) where.hospitalId = scope.hospitalId;
    if (from || to) {
      where.date = {};
      if (from) where.date[Op.gte] = from;
      if (to) where.date[Op.lte] = to;
    }

    const expenses = await Expense.findAll({ where });

    const totalExpenses = expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);

    // Category-wise breakdown
    const catMap = {};
    expenses.forEach(e => {
      if (!catMap[e.category]) catMap[e.category] = { category: e.category, total: 0, count: 0 };
      catMap[e.category].total += parseFloat(e.amount || 0);
      catMap[e.category].count++;
    });

    // Month-wise breakdown
    const monthMap = {};
    expenses.forEach(e => {
      const month = String(e.date).slice(0, 7); // YYYY-MM
      if (!monthMap[month]) monthMap[month] = { month, total: 0 };
      monthMap[month].total += parseFloat(e.amount || 0);
    });

    const monthWise = Object.values(monthMap)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(m => ({
        ...m,
        label: new Date(m.month + '-02').toLocaleString('default', { month: 'short', year: '2-digit' }),
      }));

    res.json({
      totalExpenses,
      categoryWise: Object.values(catMap).sort((a, b) => b.total - a.total),
      monthWise,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};
