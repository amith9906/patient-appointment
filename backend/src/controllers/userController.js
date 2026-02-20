const { User, Doctor } = require('../models');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { ensureScopedHospital, isSuperAdmin } = require('../utils/accessScope');

exports.getAll = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { role, search, isActive } = req.query;
    const where = {};
    if (!isSuperAdmin(req.user)) where.hospitalId = scope.hospitalId;
    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
      ];
    }
    const users = await User.findAll({
      where,
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']],
    });
    res.json(users);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getOne = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const user = await User.findByPk(req.params.id, { attributes: { exclude: ['password'] } });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!isSuperAdmin(req.user) && user.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital user' });
    }
    res.json(user);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.create = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { name, email, password, role, hospitalId } = req.body;
    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(400).json({ message: 'Email already registered' });

    if (!isSuperAdmin(req.user) && role === 'super_admin') {
      return res.status(403).json({ message: 'Only super admin can create super admin users' });
    }

    const finalHospitalId = isSuperAdmin(req.user) ? (hospitalId || null) : scope.hospitalId;
    const user = await User.create({ name, email, password, role, hospitalId: finalHospitalId });
    const { password: _, ...userOut } = user.toJSON();
    res.status(201).json(userOut);
  } catch (err) { res.status(400).json({ message: err.message }); }
};

exports.update = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!isSuperAdmin(req.user) && user.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital user' });
    }

    const { password, ...rest } = req.body;
    if (!isSuperAdmin(req.user)) {
      delete rest.hospitalId;
      if (rest.role === 'super_admin') {
        return res.status(403).json({ message: 'Only super admin can assign super_admin role' });
      }
    }
    await user.update(rest);
    if (password) await user.update({ password });
    const { password: _, ...userOut } = user.toJSON();
    res.json(userOut);
  } catch (err) { res.status(400).json({ message: err.message }); }
};

exports.toggleActive = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!isSuperAdmin(req.user) && user.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital user' });
    }
    await user.update({ isActive: !user.isActive });
    res.json({ message: `User ${user.isActive ? 'activated' : 'deactivated'}`, isActive: user.isActive });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getStats = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const roles = ['super_admin', 'admin', 'doctor', 'receptionist', 'lab_technician', 'patient'];
    const baseWhere = isSuperAdmin(req.user) ? {} : { hospitalId: scope.hospitalId };
    const counts = await Promise.all(roles.map(r => User.count({ where: { ...baseWhere, role: r } })));
    const result = {};
    roles.forEach((r, i) => { result[r] = counts[i]; });
    result.total = counts.reduce((a, b) => a + b, 0);
    res.json(result);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.assignDoctorProfile = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role !== 'doctor') return res.status(400).json({ message: 'Selected user is not a doctor role' });

    if (!isSuperAdmin(req.user) && user.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital user' });
    }

    const { doctorId, doctorEmail } = req.body;
    if (!doctorId && !doctorEmail) {
      return res.status(400).json({ message: 'doctorId or doctorEmail is required' });
    }

    const doctor = await Doctor.findOne({
      where: doctorId ? { id: doctorId } : { email: doctorEmail },
    });
    if (!doctor) return res.status(404).json({ message: 'Doctor profile not found' });

    if (!isSuperAdmin(req.user) && doctor.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital doctor profile' });
    }

    if (user.hospitalId && doctor.hospitalId && user.hospitalId !== doctor.hospitalId) {
      return res.status(400).json({ message: 'Doctor user and doctor profile belong to different hospitals' });
    }

    if (doctor.userId && doctor.userId !== user.id) {
      return res.status(400).json({ message: 'Doctor profile is already linked to another user' });
    }

    const alreadyLinked = await Doctor.findOne({ where: { userId: user.id } });
    if (alreadyLinked && alreadyLinked.id !== doctor.id) {
      return res.status(400).json({ message: 'This user is already linked to a different doctor profile' });
    }

    await doctor.update({ userId: user.id });
    if (!user.hospitalId && doctor.hospitalId) {
      await user.update({ hospitalId: doctor.hospitalId });
    }

    res.json({ message: 'Doctor profile linked successfully', userId: user.id, doctorId: doctor.id });
  } catch (err) { res.status(400).json({ message: err.message }); }
};
