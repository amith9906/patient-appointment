const { Op } = require('sequelize');
const { Vendor } = require('../models');
const { ensureScopedHospital, isSuperAdmin } = require('../utils/accessScope');

exports.getAll = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { search, category, isActive } = req.query;
    const where = {};

    if (!isSuperAdmin(req.user)) where.hospitalId = scope.hospitalId;
    else if (req.query.hospitalId) where.hospitalId = req.query.hospitalId;

    if (category) where.category = category;
    if (isActive === 'true') where.isActive = true;
    if (isActive === 'false') where.isActive = false;
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { contactPerson: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
        { gstin: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const vendors = await Vendor.findAll({
      where,
      order: [['isActive', 'DESC'], ['name', 'ASC']],
    });
    res.json(vendors);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const payload = { ...req.body };
    if (!isSuperAdmin(req.user)) payload.hospitalId = scope.hospitalId;
    if (!payload.hospitalId) {
      return res.status(400).json({ message: 'hospitalId is required' });
    }
    if (!payload.name?.trim()) {
      return res.status(400).json({ message: 'name is required' });
    }

    const vendor = await Vendor.create(payload);
    res.status(201).json(vendor);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const vendor = await Vendor.findByPk(req.params.id);
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
    if (!isSuperAdmin(req.user) && vendor.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital vendor' });
    }

    const payload = { ...req.body };
    if (!isSuperAdmin(req.user)) delete payload.hospitalId;
    await vendor.update(payload);
    res.json(vendor);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const vendor = await Vendor.findByPk(req.params.id);
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
    if (!isSuperAdmin(req.user) && vendor.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital vendor' });
    }

    await vendor.update({ isActive: false });
    res.json({ message: 'Vendor deactivated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
