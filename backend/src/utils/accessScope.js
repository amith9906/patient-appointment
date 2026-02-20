const { Doctor, Patient } = require('../models');

const isSuperAdmin = (user) => user?.role === 'super_admin';

const getUserHospitalId = async (user) => {
  if (!user) return null;
  if (user.hospitalId) return user.hospitalId;

  if (user.role === 'doctor') {
    const doctor = await Doctor.findOne({ where: { userId: user.id }, attributes: ['hospitalId'] });
    return doctor?.hospitalId || null;
  }

  if (user.role === 'patient') {
    const patient = await Patient.findOne({ where: { userId: user.id }, attributes: ['hospitalId'] });
    return patient?.hospitalId || null;
  }

  return null;
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

module.exports = {
  isSuperAdmin,
  getUserHospitalId,
  ensureScopedHospital,
};
