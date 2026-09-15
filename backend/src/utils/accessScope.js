const { Doctor, Patient, Department, Nurse } = require('../models');

const isSuperAdmin = (user) => user?.role === 'super_admin';

const userHospitalIdCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL

const getUserHospitalId = async (user) => {
  if (!user) return null;
  if (user.hospitalId) return user.hospitalId;

  const cacheKey = `${user.role}:${user.id}`;
  const cached = userHospitalIdCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.hospitalId;
  }

  let hospitalId = null;
  if (user.role === 'doctor') {
    const doctor = await Doctor.findOne({ where: { userId: user.id }, attributes: ['hospitalId'] });
    hospitalId = doctor?.hospitalId || null;
  } else if (user.role === 'nurse') {
    const nurse = await Nurse.findOne({ where: { userId: user.id }, attributes: ['hospitalId'] });
    hospitalId = nurse?.hospitalId || null;
  } else if (user.role === 'patient') {
    const patient = await Patient.findOne({ where: { userId: user.id }, attributes: ['hospitalId'] });
    hospitalId = patient?.hospitalId || null;
  }

  if (hospitalId) {
    userHospitalIdCache.set(cacheKey, { hospitalId, timestamp: Date.now() });
  }

  return hospitalId;
};

const ensureScopedHospital = async (req, res) => {
  if (isSuperAdmin(req.user)) return { allowed: true, hospitalId: null };

  const hospitalId = await getUserHospitalId(req.user);
  if (!hospitalId) {
    res.status(403).json({ message: 'User is not assigned to any hospital' });
    return { allowed: false, hospitalId: null };
  }

  return { allowed: true, hospitalId };
};

const getHODDepartmentId = async (user) => {
  if (!user) return null;
  const dept = await Department.findOne({ where: { hodUserId: user.id }, attributes: ['id'] });
  return dept?.id || null;
};

module.exports = {
  isSuperAdmin,
  getUserHospitalId,
  ensureScopedHospital,
  getHODDepartmentId,
};
