const { DoctorLeave, Doctor } = require('../models');
const { Op } = require('sequelize');
const { ensureScopedHospital, isSuperAdmin } = require('../utils/accessScope');

const normalizeDoctorLeavePayload = (payload = {}) => {
  const normalized = { ...payload };

  if (normalized.doctorId === '') normalized.doctorId = null;
  if (normalized.startTime === '') normalized.startTime = null;
  if (normalized.endTime === '') normalized.endTime = null;

  if (normalized.isFullDay) {
    normalized.startTime = null;
    normalized.endTime = null;
  }

  return normalized;
};

exports.getAll = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { doctorId, from, to } = req.query;
    const where = {};
    if (doctorId) where.doctorId = doctorId;
    if (from && to) where.leaveDate = { [Op.between]: [from, to] };
    else if (from) where.leaveDate = { [Op.gte]: from };
    else if (to) where.leaveDate = { [Op.lte]: to };

    const doctorWhere = isSuperAdmin(req.user) ? {} : { hospitalId: scope.hospitalId };

    const leaves = await DoctorLeave.findAll({
      where,
      include: [{ model: Doctor, as: 'doctor', where: doctorWhere, attributes: ['id', 'name', 'specialization'] }],
      order: [['leaveDate', 'ASC']],
    });
    res.json(leaves);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.create = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const payload = normalizeDoctorLeavePayload(req.body);
    const { doctorId, leaveDate } = payload;
    if (!doctorId) return res.status(400).json({ message: 'doctorId is required' });
    if (!leaveDate) return res.status(400).json({ message: 'leaveDate is required' });

    const doctor = await Doctor.findByPk(doctorId, { attributes: ['id', 'hospitalId'] });
    if (!doctor) return res.status(400).json({ message: 'Doctor not found' });
    if (!isSuperAdmin(req.user) && doctor.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Doctor belongs to another hospital' });
    }

    // Check for duplicate
    const existing = await DoctorLeave.findOne({ where: { doctorId, leaveDate } });
    if (existing) return res.status(400).json({ message: 'Leave already exists for this date' });

    const leave = await DoctorLeave.create(payload);
    res.status(201).json(leave);
  } catch (err) { res.status(400).json({ message: err.message }); }
};

exports.delete = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const leave = await DoctorLeave.findByPk(req.params.id, {
      include: [{ model: Doctor, as: 'doctor', attributes: ['hospitalId'] }],
    });
    if (!leave) return res.status(404).json({ message: 'Leave not found' });
    if (!isSuperAdmin(req.user) && leave.doctor?.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await leave.destroy();
    res.json({ message: 'Leave deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// Check if a doctor is on leave for a given date
exports.checkLeave = async (req, res) => {
  try {
    const { doctorId, date } = req.query;
    if (!doctorId || !date) return res.json({ onLeave: false });

    const leave = await DoctorLeave.findOne({ where: { doctorId, leaveDate: date } });
    res.json({ onLeave: !!leave, leave: leave || null });
  } catch (err) { res.status(500).json({ message: err.message }); }
};
