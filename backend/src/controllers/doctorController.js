const { Doctor, Hospital, Department, Appointment, Patient } = require('../models');
const { Op } = require('sequelize');
const { ensureScopedHospital, isSuperAdmin } = require('../utils/accessScope');

const normalizeDoctorPayload = (payload = {}) => {
  const normalized = { ...payload };

  ['hospitalId', 'departmentId', 'userId'].forEach((field) => {
    if (normalized[field] === '') normalized[field] = null;
  });

  return normalized;
};

const resolveDoctorProfileForUser = async (user) => {
  let doctor = await Doctor.findOne({ where: { userId: user.id } });
  if (doctor) return doctor;

  if (user.email) {
    doctor = await Doctor.findOne({ where: { email: user.email } });
    if (doctor) {
      if (!doctor.userId) {
        await doctor.update({ userId: user.id });
      }
      return doctor;
    }
  }

  if (user.name && user.hospitalId) {
    const matches = await Doctor.findAll({
      where: {
        name: user.name,
        hospitalId: user.hospitalId,
      },
      order: [['createdAt', 'DESC']],
      limit: 2,
    });

    if (matches.length === 1) {
      doctor = matches[0];
      if (!doctor.userId) {
        await doctor.update({ userId: user.id });
      }
      return doctor;
    }
  }

  return null;
};

exports.getMe = async (req, res) => {
  try {
    const profile = await resolveDoctorProfileForUser(req.user);
    if (!profile) return res.status(404).json({ message: 'Doctor profile not found. Contact admin.' });

    const doctor = await Doctor.findByPk(profile.id, {
      include: [
        { model: Hospital, as: 'hospital' },
        { model: Department, as: 'department' },
      ],
    });
    res.json(doctor);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getMyAppointments = async (req, res) => {
  try {
    const doctor = await resolveDoctorProfileForUser(req.user);
    if (!doctor) return res.status(404).json({ message: 'Doctor profile not found' });
    const { status, date, from, to } = req.query;
    const where = { doctorId: doctor.id };
    if (status) where.status = status;
    if (date) where.appointmentDate = date;
    else if (from && to) where.appointmentDate = { [Op.between]: [from, to] };
    const appointments = await Appointment.findAll({
      where,
      include: [{ model: Patient, as: 'patient', attributes: ['id', 'name', 'patientId', 'phone', 'dateOfBirth', 'bloodGroup', 'allergies'] }],
      order: [['appointmentDate', 'DESC'], ['appointmentTime', 'DESC']],
    });
    res.json(appointments);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getMyPatients = async (req, res) => {
  try {
    const doctor = await resolveDoctorProfileForUser(req.user);
    if (!doctor) return res.status(404).json({ message: 'Doctor profile not found' });
    const appointments = await Appointment.findAll({
      where: { doctorId: doctor.id },
      include: [{ model: Patient, as: 'patient' }],
      attributes: ['patientId'],
    });
    const uniquePatientIds = [...new Set(appointments.map(a => a.patientId))];
    const patients = await Patient.findAll({ where: { id: uniquePatientIds }, order: [['createdAt', 'DESC']] });
    res.json(patients);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getAll = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { hospitalId, departmentId, specialization, search } = req.query;
    const where = {};
    if (isSuperAdmin(req.user)) {
      if (hospitalId) where.hospitalId = hospitalId;
    } else {
      where.hospitalId = scope.hospitalId;
    }
    if (departmentId) where.departmentId = departmentId;
    if (specialization) where.specialization = { [Op.iLike]: `%${specialization}%` };
    if (search) where.name = { [Op.iLike]: `%${search}%` };

    const doctors = await Doctor.findAll({
      where,
      include: [
        { model: Hospital, as: 'hospital', attributes: ['id', 'name'] },
        { model: Department, as: 'department', attributes: ['id', 'name'] },
      ],
      order: [['createdAt', 'DESC']],
    });
    res.json(doctors);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getOne = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const doctor = await Doctor.findByPk(req.params.id, {
      include: [
        { model: Hospital, as: 'hospital' },
        { model: Department, as: 'department' },
      ],
    });
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });
    if (!isSuperAdmin(req.user) && doctor.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital doctor' });
    }
    res.json(doctor);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.create = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const payload = normalizeDoctorPayload(req.body);
    if (!isSuperAdmin(req.user)) payload.hospitalId = scope.hospitalId;
    if (!payload.hospitalId) return res.status(400).json({ message: 'hospitalId is required' });

    const doctor = await Doctor.create(payload);
    res.status(201).json(doctor);
  } catch (err) { res.status(400).json({ message: err.message }); }
};

exports.update = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const doctor = await Doctor.findByPk(req.params.id);
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });

    if (!isSuperAdmin(req.user) && doctor.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital doctor' });
    }

    const payload = normalizeDoctorPayload(req.body);
    if (!isSuperAdmin(req.user)) delete payload.hospitalId;
    await doctor.update(payload);
    res.json(doctor);
  } catch (err) { res.status(400).json({ message: err.message }); }
};

exports.delete = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const doctor = await Doctor.findByPk(req.params.id);
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });
    if (!isSuperAdmin(req.user) && doctor.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital doctor' });
    }
    await doctor.update({ isActive: false });
    res.json({ message: 'Doctor deactivated' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getAvailableSlots = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { date } = req.query;
    const doctor = await Doctor.findByPk(req.params.id);
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });
    if (!isSuperAdmin(req.user) && doctor.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital doctor' });
    }

    const bookedAppointments = await Appointment.findAll({
      where: {
        doctorId: req.params.id,
        appointmentDate: date,
        status: { [Op.notIn]: ['cancelled', 'no_show'] },
      },
    });

    const bookedTimes = bookedAppointments.map((a) => a.appointmentTime);
    const slots = [];
    const start = parseInt(doctor.availableFrom.split(':')[0]);
    const end = parseInt(doctor.availableTo.split(':')[0]);

    for (let h = start; h < end; h++) {
      for (let m = 0; m < 60; m += 30) {
        const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        slots.push({ time, available: !bookedTimes.includes(time) });
      }
    }
    res.json(slots);
  } catch (err) { res.status(500).json({ message: err.message }); }
};
