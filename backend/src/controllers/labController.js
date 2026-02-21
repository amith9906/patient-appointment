const { Lab, Hospital, LabTest, Patient, Doctor, Appointment } = require('../models');
const { Op } = require('sequelize');
const { ensureScopedHospital, isSuperAdmin } = require('../utils/accessScope');

exports.getAllLabs = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const where = { isActive: true };
    if (!isSuperAdmin(req.user)) where.hospitalId = scope.hospitalId;

    const labs = await Lab.findAll({
      where,
      include: [{ model: Hospital, as: 'hospital', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
    });
    res.json(labs);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.createLab = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const payload = { ...req.body };
    if (!isSuperAdmin(req.user)) payload.hospitalId = scope.hospitalId;
    if (!payload.hospitalId) return res.status(400).json({ message: 'hospitalId is required' });

    const lab = await Lab.create(payload);
    res.status(201).json(lab);
  } catch (err) { res.status(400).json({ message: err.message }); }
};

exports.updateLab = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const lab = await Lab.findByPk(req.params.id);
    if (!lab) return res.status(404).json({ message: 'Lab not found' });
    if (!isSuperAdmin(req.user) && lab.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital lab' });
    }

    const payload = { ...req.body };
    if (!isSuperAdmin(req.user)) delete payload.hospitalId;
    await lab.update(payload);
    res.json(lab);
  } catch (err) { res.status(400).json({ message: err.message }); }
};

exports.deleteLab = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const lab = await Lab.findByPk(req.params.id);
    if (!lab) return res.status(404).json({ message: 'Lab not found' });
    if (!isSuperAdmin(req.user) && lab.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital lab' });
    }
    await lab.update({ isActive: false });
    res.json({ message: 'Lab deactivated' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// Lab Tests
exports.getAllTests = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { labId, patientId, status, search } = req.query;
    const where = {};
    if (labId) where.labId = labId;
    if (patientId) where.patientId = patientId;
    if (status) where.status = status;
    if (search) where.testName = { [Op.iLike]: `%${search}%` };

    const tests = await LabTest.findAll({
      where,
      include: [
        {
          model: Lab,
          as: 'lab',
          attributes: ['id', 'name', 'hospitalId'],
          ...(isSuperAdmin(req.user) ? {} : { where: { hospitalId: scope.hospitalId } }),
        },
        { model: Patient, as: 'patient', attributes: ['id', 'name', 'patientId'] },
        { model: Appointment, as: 'appointment', attributes: ['id', 'appointmentNumber'] },
      ],
      order: [['orderedDate', 'DESC']],
    });
    res.json(tests);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getOneTest = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const test = await LabTest.findByPk(req.params.id, {
      include: [
        { model: Lab, as: 'lab' },
        { model: Patient, as: 'patient' },
        { model: Appointment, as: 'appointment' },
      ],
    });
    if (!test) return res.status(404).json({ message: 'Lab test not found' });
    if (!isSuperAdmin(req.user) && test.lab?.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital lab test' });
    }
    res.json(test);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.createTest = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const payload = { ...req.body };
    const lab = await Lab.findByPk(payload.labId, { attributes: ['id', 'hospitalId', 'isActive'] });
    if (!lab || !lab.isActive) return res.status(400).json({ message: 'Lab not found' });
    if (!isSuperAdmin(req.user) && lab.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Lab belongs to another hospital' });
    }

    if (payload.patientId) {
      const patient = await Patient.findByPk(payload.patientId, { attributes: ['id', 'hospitalId'] });
      if (!patient) return res.status(400).json({ message: 'Patient not found' });
      if (patient.hospitalId !== lab.hospitalId) {
        return res.status(400).json({ message: 'Patient belongs to another hospital' });
      }
    }

    if (payload.appointmentId) {
      const appointment = await Appointment.findByPk(payload.appointmentId, {
        include: [{ model: Doctor, as: 'doctor', attributes: ['hospitalId'] }],
      });
      if (!appointment) return res.status(400).json({ message: 'Appointment not found' });
      if (appointment.doctor?.hospitalId !== lab.hospitalId) {
        return res.status(400).json({ message: 'Appointment belongs to another hospital' });
      }
    }

    const test = await LabTest.create(payload);
    res.status(201).json(test);
  } catch (err) { res.status(400).json({ message: err.message }); }
};

exports.updateTest = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const test = await LabTest.findByPk(req.params.id);
    if (!test) return res.status(404).json({ message: 'Lab test not found' });
    const lab = await Lab.findByPk(test.labId, { attributes: ['hospitalId'] });
    if (!isSuperAdmin(req.user) && lab?.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital lab test' });
    }
    if (req.body.status === 'completed' && !req.body.completedDate) {
      req.body.completedDate = new Date();
    }
    await test.update(req.body);
    res.json(test);
  } catch (err) { res.status(400).json({ message: err.message }); }
};

exports.deleteTest = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const test = await LabTest.findByPk(req.params.id);
    if (!test) return res.status(404).json({ message: 'Lab test not found' });
    const lab = await Lab.findByPk(test.labId, { attributes: ['hospitalId'] });
    if (!isSuperAdmin(req.user) && lab?.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital lab test' });
    }
    await test.update({ status: 'cancelled' });
    res.json({ message: 'Lab test cancelled' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};
