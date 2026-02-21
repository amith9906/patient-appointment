const { Patient, Hospital, Appointment, Report, LabTest, Doctor, Vitals } = require('../models');
const { Op } = require('sequelize');
const { ensureScopedHospital, isSuperAdmin } = require('../utils/accessScope');

exports.getMe = async (req, res) => {
  try {
    const patient = await Patient.findOne({
      where: { userId: req.user.id },
      include: [{ model: Hospital, as: 'hospital', attributes: ['id', 'name'] }],
    });
    if (!patient) return res.status(404).json({ message: 'Patient profile not found. Contact reception.' });
    res.json(patient);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getMyAppointments = async (req, res) => {
  try {
    const patient = await Patient.findOne({ where: { userId: req.user.id } });
    if (!patient) return res.status(404).json({ message: 'Patient profile not found' });
    const { status } = req.query;
    const where = { patientId: patient.id };
    if (status) where.status = status;
    const appointments = await Appointment.findAll({
      where,
      include: [{ model: Doctor, as: 'doctor', attributes: ['id', 'name', 'specialization', 'phone'] }],
      order: [['appointmentDate', 'DESC'], ['appointmentTime', 'DESC']],
    });
    res.json(appointments);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getMyReports = async (req, res) => {
  try {
    const patient = await Patient.findOne({ where: { userId: req.user.id } });
    if (!patient) return res.status(404).json({ message: 'Patient profile not found' });
    const reports = await Report.findAll({
      where: { patientId: patient.id, isActive: true },
      order: [['createdAt', 'DESC']],
    });
    res.json(reports);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.bookAppointment = async (req, res) => {
  try {
    const patient = await Patient.findOne({ where: { userId: req.user.id } });
    if (!patient) return res.status(404).json({ message: 'Patient profile not found' });

    const doctor = await Doctor.findByPk(req.body.doctorId, { attributes: ['id', 'hospitalId'] });
    if (!doctor) return res.status(400).json({ message: 'Doctor not found' });
    if (doctor.hospitalId !== patient.hospitalId) {
      return res.status(400).json({ message: 'Doctor belongs to another hospital' });
    }

    const conflict = await Appointment.findOne({
      where: {
        doctorId: req.body.doctorId,
        appointmentDate: req.body.appointmentDate,
        appointmentTime: req.body.appointmentTime,
        status: { [Op.notIn]: ['cancelled', 'no_show'] },
      },
    });
    if (conflict) return res.status(400).json({ message: 'Time slot already booked' });
    const appt = await Appointment.create({ ...req.body, patientId: patient.id });
    const full = await Appointment.findByPk(appt.id, {
      include: [{ model: Doctor, as: 'doctor', attributes: ['id', 'name', 'specialization'] }],
    });
    res.status(201).json(full);
  } catch (err) { res.status(400).json({ message: err.message }); }
};

exports.getAll = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { hospitalId, search, bloodGroup } = req.query;
    const where = { isActive: true };
    if (isSuperAdmin(req.user)) {
      if (hospitalId) where.hospitalId = hospitalId;
    } else {
      where.hospitalId = scope.hospitalId;
    }
    if (bloodGroup) where.bloodGroup = bloodGroup;
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { patientId: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
      ];
    }
    const patients = await Patient.findAll({
      where,
      include: [{ model: Hospital, as: 'hospital', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
    });
    res.json(patients);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getOne = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const patient = await Patient.findByPk(req.params.id, {
      include: [
        { model: Hospital, as: 'hospital', attributes: ['id', 'name'] },
        {
          model: Appointment, as: 'appointments',
          include: [{ model: Doctor, as: 'doctor', attributes: ['id', 'name', 'specialization'] }],
          order: [['appointmentDate', 'DESC']],
          limit: 10,
        },
        { model: Report, as: 'reports', order: [['createdAt', 'DESC']] },
      ],
    });
    if (!patient) return res.status(404).json({ message: 'Patient not found' });
    if (!isSuperAdmin(req.user) && patient.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital patient' });
    }
    res.json(patient);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.create = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;
console.log('Request body for creating patient:', req.body);
    const payload = { ...req.body };
    if (!isSuperAdmin(req.user)) payload.hospitalId = scope.hospitalId;
    if (payload.email === '')       payload.email = null;
    if (payload.dateOfBirth === '') payload.dateOfBirth = null;
    if (payload.bloodGroup === '')  payload.bloodGroup = null;
    if (!payload.name?.trim()) return res.status(400).json({ message: 'name is required' });
    if (!payload.phone?.trim()) return res.status(400).json({ message: 'phone is required' });
    if (!payload.hospitalId) return res.status(400).json({ message: 'hospitalId is required' });
console.log('Creating patient with payload:', payload);
    const patient = await Patient.create(payload);
    res.status(201).json(patient);
  } catch (err) { res.status(400).json({ message: err.message }); }
};

exports.update = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const patient = await Patient.findByPk(req.params.id);
    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    if (!isSuperAdmin(req.user) && patient.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital patient' });
    }

    const payload = { ...req.body };
    if (payload.email === '')       payload.email = null;
    if (payload.dateOfBirth === '') payload.dateOfBirth = null;
    if (payload.bloodGroup === '')  payload.bloodGroup = null;
    if (!isSuperAdmin(req.user)) delete payload.hospitalId;
    await patient.update(payload);
    res.json(patient);
  } catch (err) { res.status(400).json({ message: err.message }); }
};

exports.delete = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const patient = await Patient.findByPk(req.params.id);
    if (!patient) return res.status(404).json({ message: 'Patient not found' });
    if (!isSuperAdmin(req.user) && patient.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital patient' });
    }
    await patient.update({ isActive: false });
    res.json({ message: 'Patient deactivated' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getMedicalHistory = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { Prescription, Medication } = require('../models');
    const patient = await Patient.findByPk(req.params.id, {
      include: [
        {
          model: Appointment,
          as: 'appointments',
          include: [
            { model: Doctor, as: 'doctor', attributes: ['id', 'name', 'specialization'] },
            {
              model: Prescription,
              as: 'prescriptions',
              include: [{ model: Medication, as: 'medication', attributes: ['id', 'name', 'dosage', 'category', 'composition'] }],
            },
            { model: Vitals, as: 'vitals' },
          ],
          order: [['appointmentDate', 'DESC'], ['appointmentTime', 'DESC']],
        },
        { model: LabTest, as: 'labTests' },
        { model: Report, as: 'reports' },
      ],
    });
    if (!patient) return res.status(404).json({ message: 'Patient not found' });
    if (!isSuperAdmin(req.user) && patient.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital patient' });
    }
    res.json(patient);
  } catch (err) { res.status(500).json({ message: err.message }); }
};
