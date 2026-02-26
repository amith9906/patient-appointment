const { sequelize, NurseLeave, Nurse, User } = require('../models');
const { ensureScopedHospital, isSuperAdmin } = require('../utils/accessScope');
const { Op } = require('sequelize');
const notificationService = require('../utils/notificationService');

const normalizeTime = (value) => {
  const v = String(value || '').trim();
  if (!v) return null;
  const normalized = /^\d{2}:\d{2}(:\d{2})?$/.test(v) ? v : null;
  return normalized;
};

exports.getAll = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { nurseId, status, from, to } = req.query;
    const where = {};
    const nurseWhere = isSuperAdmin(req.user) ? {} : { hospitalId: scope.hospitalId };

    if (nurseId) where.nurseId = nurseId;
    if (status) where.status = status;
    if (from || to) {
      where.leaveDate = {};
      if (from) where.leaveDate[Op.gte] = from;
      if (to) where.leaveDate[Op.lte] = to;
    }

    const fetchLeaves = async () => NurseLeave.findAll({
      where,
      include: [
        { model: Nurse, as: 'nurse', where: nurseWhere, attributes: ['id', 'name'] },
        { model: User, as: 'approvedBy', attributes: ['id', 'name'] },
      ],
      order: [['leaveDate', 'DESC']],
    });

    let leaves;
    try {
      leaves = await fetchLeaves();
    } catch (err) {
      if (!String(err.message || '').includes('invalid input syntax for type time')) throw err;
      await sequelize.query('UPDATE "NurseLeaves" SET "startTime" = NULL WHERE "startTime"::text = \'\' ');
      await sequelize.query('UPDATE "NurseLeaves" SET "endTime" = NULL WHERE "endTime"::text = \'\' ');
      leaves = await fetchLeaves();
    }

    res.json(leaves);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.apply = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    let nurseId = req.body.nurseId;

    // If a nurse is applying for themselves
    if (!nurseId && req.user.role === 'nurse') {
      const nurse = await Nurse.findOne({ where: { userId: req.user.id } });
      if (nurse) nurseId = nurse.id;
    }

    if (!nurseId) return res.status(400).json({ message: 'nurseId is required' });

    // Verify nurse belongs to hospital
    const nurse = await Nurse.findByPk(nurseId, {
      include: [{ model: User, as: 'user', attributes: ['id', 'email', 'name'] }],
    });
    if (!nurse) return res.status(404).json({ message: 'Nurse not found' });
    if (!isSuperAdmin(req.user) && nurse.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const isFullDay = req.body.isFullDay !== false && String(req.body.isFullDay) !== 'false';
    const payload = {
      leaveDate: req.body.leaveDate,
      reason: req.body.reason || null,
      isFullDay,
      startTime: isFullDay ? null : normalizeTime(req.body.startTime),
      endTime: isFullDay ? null : normalizeTime(req.body.endTime),
      nurseId,
      status: 'pending',
      approvedByUserId: null,
      approvalDate: null,
    };

    if (!isFullDay && (!payload.startTime || !payload.endTime)) {
      return res.status(400).json({ message: 'startTime and endTime are required for partial-day leave' });
    }

    const leave = await NurseLeave.create(payload);
    await notificationService.notifyLeaveApplication(leave, nurse);

    res.status(201).json(leave);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.approve = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const leave = await NurseLeave.findByPk(req.params.id, {
      include: [{ model: Nurse, as: 'nurse', include: [{ model: User, as: 'user', attributes: ['id', 'email', 'name'] }] }],
    });

    if (!leave) return res.status(404).json({ message: 'Leave request not found' });
    if (leave.status !== 'pending') return res.status(400).json({ message: 'Only pending leaves can be approved' });
    if (!isSuperAdmin(req.user) && leave.nurse.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (leave.nurse?.userId && String(leave.nurse.userId) === String(req.user.id)) {
      return res.status(403).json({ message: 'You cannot approve your own leave request' });
    }

    let isAllowed = isSuperAdmin(req.user) || (req.user.role === 'admin' && leave.nurse?.hospitalId === scope.hospitalId);
    if (!isAllowed && leave.nurse?.departmentId) {
      const { Department } = require('../models');
      const dept = await Department.findByPk(leave.nurse.departmentId, { attributes: ['id', 'hodUserId'] });
      if (dept && String(dept.hodUserId) === String(req.user.id)) isAllowed = true;
    }
    if (!isAllowed) return res.status(403).json({ message: 'Access denied. Only admins or HOD can approve leaves.' });

    await leave.update({
      status: 'approved',
      approvedByUserId: req.user.id,
      approvalDate: new Date(),
    });

    await leave.reload({
      include: [
        { model: Nurse, as: 'nurse', include: [{ model: User, as: 'user', attributes: ['id', 'email', 'name'] }] },
        { model: User, as: 'approvedBy', attributes: ['id', 'name'] },
      ],
    });
    await notificationService.notifyLeaveDecision(leave, 'approved');

    res.json(leave);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.reject = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const leave = await NurseLeave.findByPk(req.params.id, {
      include: [{ model: Nurse, as: 'nurse', include: [{ model: User, as: 'user', attributes: ['id', 'email', 'name'] }] }],
    });

    if (!leave) return res.status(404).json({ message: 'Leave request not found' });
    if (leave.status !== 'pending') return res.status(400).json({ message: 'Only pending leaves can be rejected' });
    if (!isSuperAdmin(req.user) && leave.nurse.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (leave.nurse?.userId && String(leave.nurse.userId) === String(req.user.id)) {
      return res.status(403).json({ message: 'You cannot reject your own leave request' });
    }

    let isAllowed = isSuperAdmin(req.user) || (req.user.role === 'admin' && leave.nurse?.hospitalId === scope.hospitalId);
    if (!isAllowed && leave.nurse?.departmentId) {
      const { Department } = require('../models');
      const dept = await Department.findByPk(leave.nurse.departmentId, { attributes: ['id', 'hodUserId'] });
      if (dept && String(dept.hodUserId) === String(req.user.id)) isAllowed = true;
    }
    if (!isAllowed) return res.status(403).json({ message: 'Access denied. Only admins or HOD can reject leaves.' });

    await leave.update({
      status: 'rejected',
      approvedByUserId: req.user.id,
      approvalDate: new Date(),
    });

    await leave.reload({
      include: [
        { model: Nurse, as: 'nurse', include: [{ model: User, as: 'user', attributes: ['id', 'email', 'name'] }] },
        { model: User, as: 'approvedBy', attributes: ['id', 'name'] },
      ],
    });
    await notificationService.notifyLeaveDecision(leave, 'rejected');

    res.json(leave);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const leave = await NurseLeave.findByPk(req.params.id, {
      include: [{ model: Nurse, as: 'nurse' }]
    });

    if (!leave) return res.status(404).json({ message: 'Leave request not found' });
    if (!isSuperAdmin(req.user) && leave.nurse.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (leave.status !== 'pending' && !isSuperAdmin(req.user)) {
      return res.status(400).json({ message: 'Cannot delete processed leave request' });
    }

    await leave.destroy();
    res.json({ message: 'Leave request deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
