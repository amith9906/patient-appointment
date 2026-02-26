const { DoctorLeave, Doctor, User } = require('../models');
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

  // Leave requests must always go through approval workflow.
  normalized.status = 'pending';
  normalized.approvedByUserId = null;
  normalized.approvalDate = null;

  return normalized;
};

exports.getAll = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { doctorId, from, to, status } = req.query;
    const where = {};
    if (doctorId) where.doctorId = doctorId;
    if (status) where.status = status;
    if (from && to) where.leaveDate = { [Op.between]: [from, to] };
    else if (from) where.leaveDate = { [Op.gte]: from };
    else if (to) where.leaveDate = { [Op.lte]: to };

    const doctorWhere = isSuperAdmin(req.user) ? {} : { hospitalId: scope.hospitalId };

    const leaves = await DoctorLeave.findAll({
      where,
      include: [
        { model: Doctor, as: 'doctor', where: doctorWhere, attributes: ['id', 'name', 'specialization'] },
        { model: User, as: 'approvedBy', attributes: ['id', 'name', 'role'], required: false },
      ],
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
    const { leaveDate } = payload;
    let { doctorId } = payload;
    if (!doctorId) return res.status(400).json({ message: 'doctorId is required' });
    if (!leaveDate) return res.status(400).json({ message: 'leaveDate is required' });

    // Doctors can only raise leave for themselves.
    if (req.user.role === 'doctor') {
      const doctorProfile = await Doctor.findOne({ where: { userId: req.user.id }, attributes: ['id'] });
      if (!doctorProfile) return res.status(403).json({ message: 'Doctor profile not found for current user' });
      if (doctorId && String(doctorId) !== String(doctorProfile.id)) {
        return res.status(403).json({ message: 'You can only raise leave for your own profile' });
      }
      doctorId = doctorProfile.id;
      payload.doctorId = doctorId;
    }

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

    const leave = await DoctorLeave.findOne({ 
      where: { 
        doctorId, 
        leaveDate: date,
        status: 'approved'
      } 
    });
    res.json({ onLeave: !!leave, leave: leave || null });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.approve = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const leave = await DoctorLeave.findByPk(req.params.id, {
      include: [{ model: Doctor, as: 'doctor', attributes: ['id', 'hospitalId', 'departmentId', 'userId'] }],
    });
    if (!leave) return res.status(404).json({ message: 'Leave not found' });
    if (leave.status !== 'pending') return res.status(400).json({ message: 'Only pending leaves can be approved' });
    if (leave.doctor?.userId && leave.doctor.userId === req.user.id) {
      return res.status(403).json({ message: 'You cannot approve your own leave request' });
    }

    // Permission check: admin or HOD of the department
    let isAllowed = isSuperAdmin(req.user) || (req.user.role === 'admin' && leave.doctor?.hospitalId === scope.hospitalId);
    
    if (!isAllowed && leave.doctor?.departmentId) {
      const { Department } = require('../models');
      const dept = await Department.findByPk(leave.doctor.departmentId);
      if (dept && dept.hodUserId === req.user.id) {
        isAllowed = true;
      }
    }

    if (!isAllowed) return res.status(403).json({ message: 'Access denied. Only admins or HOD can approve leaves.' });

    await leave.update({
      status: 'approved',
      approvedByUserId: req.user.id,
      approvalDate: new Date(),
    });

    res.json(leave);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.reject = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const leave = await DoctorLeave.findByPk(req.params.id, {
      include: [{ model: Doctor, as: 'doctor', attributes: ['id', 'hospitalId', 'departmentId', 'userId'] }],
    });
    if (!leave) return res.status(404).json({ message: 'Leave not found' });
    if (leave.status !== 'pending') return res.status(400).json({ message: 'Only pending leaves can be rejected' });
    if (leave.doctor?.userId && leave.doctor.userId === req.user.id) {
      return res.status(403).json({ message: 'You cannot reject your own leave request' });
    }

    // Permission check: same as approve
    let isAllowed = isSuperAdmin(req.user) || (req.user.role === 'admin' && leave.doctor?.hospitalId === scope.hospitalId);
    
    if (!isAllowed && leave.doctor?.departmentId) {
      const { Department } = require('../models');
      const dept = await Department.findByPk(leave.doctor.departmentId);
      if (dept && dept.hodUserId === req.user.id) {
        isAllowed = true;
      }
    }

    if (!isAllowed) return res.status(403).json({ message: 'Access denied.' });

    await leave.update({
      status: 'rejected',
      approvedByUserId: req.user.id,
      approvalDate: new Date(),
    });

    res.json(leave);
  } catch (err) { res.status(500).json({ message: err.message }); }
};
