const router = require('express').Router();
const { Department, Hospital, Doctor, User } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { ensureScopedHospital, isSuperAdmin } = require('../utils/accessScope');

router.use(authenticate);

router.get('/', authorize('super_admin', 'admin', 'receptionist', 'doctor'), async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { hospitalId } = req.query;
    const where = {};
    if (isSuperAdmin(req.user)) {
      if (hospitalId) where.hospitalId = hospitalId;
    } else {
      where.hospitalId = scope.hospitalId;
    }

    const departments = await Department.findAll({
      where,
      include: [
        { model: Hospital, as: 'hospital', attributes: ['id', 'name'] },
        { model: User, as: 'hod', attributes: ['id', 'name'] }
      ],
      order: [['createdAt', 'DESC']],
    });
    res.json(departments);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', authorize('super_admin', 'admin', 'receptionist'), async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const payload = { ...req.body };
    if (!isSuperAdmin(req.user)) payload.hospitalId = scope.hospitalId;
    if (!payload.hospitalId) return res.status(400).json({ message: 'hospitalId is required' });

    // Normalize: convert empty strings to null for UUID fields
    if (payload.hodUserId === '') payload.hodUserId = null;
    if (payload.hospitalId === '') payload.hospitalId = null;

    const dept = await Department.create(payload);
    res.status(201).json(dept);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

router.put('/:id', authorize('super_admin', 'admin', 'receptionist'), async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const dept = await Department.findByPk(req.params.id);
    if (!dept) return res.status(404).json({ message: 'Department not found' });

    if (!isSuperAdmin(req.user) && dept.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital department' });
    }

    const payload = { ...req.body };
    if (!isSuperAdmin(req.user)) delete payload.hospitalId;

    // Normalize: convert empty strings to null for UUID fields
    if (payload.hodUserId === '') payload.hodUserId = null;
    if (payload.hospitalId === '') payload.hospitalId = null;

    await dept.update(payload);
    res.json(dept);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

router.delete('/:id', authorize('super_admin', 'admin'), async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const dept = await Department.findByPk(req.params.id);
    if (!dept) return res.status(404).json({ message: 'Department not found' });

    if (!isSuperAdmin(req.user) && dept.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital department' });
    }

    await dept.update({ isActive: false });
    res.json({ message: 'Department deactivated' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
