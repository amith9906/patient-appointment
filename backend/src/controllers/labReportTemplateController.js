const { LabReportTemplate } = require('../models');
const { Op } = require('sequelize');
const { ensureScopedHospital, isSuperAdmin } = require('../utils/accessScope');

exports.getAll = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { category, search } = req.query;
    const where = { isActive: true };

    // Return templates for this hospital + global templates (hospitalId = null)
    if (!isSuperAdmin(req.user)) {
      where[Op.or] = [{ hospitalId: scope.hospitalId }, { hospitalId: null }];
    }
    if (category) where.category = { [Op.iLike]: `%${category}%` };
    if (search) where.name = { [Op.iLike]: `%${search}%` };

    const templates = await LabReportTemplate.findAll({
      where,
      order: [['category', 'ASC'], ['name', 'ASC']],
    });
    res.json(templates);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getOne = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const tpl = await LabReportTemplate.findByPk(req.params.id);
    if (!tpl || !tpl.isActive) return res.status(404).json({ message: 'Template not found' });
    if (!isSuperAdmin(req.user) && tpl.hospitalId && tpl.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    res.json(tpl);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.create = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const payload = { ...req.body };
    // Super admin can create global templates (hospitalId = null); others tied to their hospital
    if (!isSuperAdmin(req.user)) payload.hospitalId = scope.hospitalId;

    const tpl = await LabReportTemplate.create(payload);
    res.status(201).json(tpl);
  } catch (err) { res.status(400).json({ message: err.message }); }
};

exports.update = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const tpl = await LabReportTemplate.findByPk(req.params.id);
    if (!tpl || !tpl.isActive) return res.status(404).json({ message: 'Template not found' });
    if (!isSuperAdmin(req.user) && tpl.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const payload = { ...req.body };
    if (!isSuperAdmin(req.user)) delete payload.hospitalId;
    await tpl.update(payload);
    res.json(tpl);
  } catch (err) { res.status(400).json({ message: err.message }); }
};

exports.delete = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const tpl = await LabReportTemplate.findByPk(req.params.id);
    if (!tpl || !tpl.isActive) return res.status(404).json({ message: 'Template not found' });
    if (!isSuperAdmin(req.user) && tpl.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    await tpl.update({ isActive: false });
    res.json({ message: 'Template deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};
