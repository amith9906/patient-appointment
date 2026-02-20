const { Hospital, Department, Doctor } = require('../models');
const { ensureScopedHospital, isSuperAdmin } = require('../utils/accessScope');

exports.getAll = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const where = {};
    if (!isSuperAdmin(req.user)) where.id = scope.hospitalId;

    const hospitals = await Hospital.findAll({
      where,
      include: [{ model: Department, as: 'departments' }],
      order: [['createdAt', 'DESC']],
    });
    res.json(hospitals);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getOne = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;
    if (!isSuperAdmin(req.user) && req.params.id !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital' });
    }

    const hospital = await Hospital.findByPk(req.params.id, {
      include: [
        { model: Department, as: 'departments' },
        { model: Doctor, as: 'doctors' },
      ],
    });
    if (!hospital) return res.status(404).json({ message: 'Hospital not found' });
    res.json(hospital);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.create = async (req, res) => {
  try {
    if (!isSuperAdmin(req.user)) {
      return res.status(403).json({ message: 'Only super admin can create hospitals' });
    }
    const hospital = await Hospital.create(req.body);
    res.status(201).json(hospital);
  } catch (err) { res.status(400).json({ message: err.message }); }
};

exports.update = async (req, res) => {
  try {
    if (!isSuperAdmin(req.user)) {
      return res.status(403).json({ message: 'Only super admin can update hospitals' });
    }
    const hospital = await Hospital.findByPk(req.params.id);
    if (!hospital) return res.status(404).json({ message: 'Hospital not found' });
    await hospital.update(req.body);
    res.json(hospital);
  } catch (err) { res.status(400).json({ message: err.message }); }
};

exports.delete = async (req, res) => {
  try {
    if (!isSuperAdmin(req.user)) {
      return res.status(403).json({ message: 'Only super admin can deactivate hospitals' });
    }
    const hospital = await Hospital.findByPk(req.params.id);
    if (!hospital) return res.status(404).json({ message: 'Hospital not found' });
    await hospital.update({ isActive: false });
    res.json({ message: 'Hospital deactivated' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getStats = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;
    if (!isSuperAdmin(req.user) && req.params.id !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital' });
    }

    const { Doctor, Patient, Appointment } = require('../models');
    const { Op } = require('sequelize');
    const hospital = await Hospital.findByPk(req.params.id);
    if (!hospital) return res.status(404).json({ message: 'Hospital not found' });

    const [doctors, patients, departments] = await Promise.all([
      Doctor.count({ where: { hospitalId: req.params.id } }),
      Patient.count({ where: { hospitalId: req.params.id } }),
      Department.count({ where: { hospitalId: req.params.id } }),
    ]);

    res.json({ doctors, patients, departments });
  } catch (err) { res.status(500).json({ message: err.message }); }
};
