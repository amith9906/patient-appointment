const { Lab, Hospital, LabTest, LabReportTemplate, Report, Patient, Doctor, Appointment } = require('../models');
const { Op } = require('sequelize');
const { ensureScopedHospital, isSuperAdmin } = require('../utils/accessScope');
const { getPaginationParams, buildPaginationMeta, applyPaginationOptions } = require('../utils/pagination');

const normalizeLabTestPayload = (payload = {}) => {
  const normalized = { ...payload };

  ['labId', 'patientId', 'appointmentId', 'templateId'].forEach((field) => {
    if (normalized[field] === '') normalized[field] = null;
  });

  return normalized;
};

exports.getAllLabs = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const where = { isActive: true };
    if (!isSuperAdmin(req.user)) where.hospitalId = scope.hospitalId;

    const pagination = getPaginationParams(req, { defaultPerPage: 20, forcePaginate: req.query.paginate !== 'false' });
    const baseOptions = {
      where,
      include: [{ model: Hospital, as: 'hospital', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
    };
    if (pagination) {
      const queryOptions = applyPaginationOptions(baseOptions, pagination, { forceDistinct: true });
      const labs = await Lab.findAndCountAll(queryOptions);
      return res.json({
        data: labs.rows,
        meta: buildPaginationMeta(pagination, labs.count),
      });
    }
    const labs = await Lab.findAll(baseOptions);
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

    const { labId, patientId, status, search, appointmentId } = req.query;
    const where = {};
    if (labId) where.labId = labId;
    if (patientId) where.patientId = patientId;
    if (appointmentId) where.appointmentId = appointmentId;
    if (status) where.status = status;
    if (search) where.testName = { [Op.iLike]: `%${search}%` };

      const pagination = getPaginationParams(req, { defaultPerPage: 25, forcePaginate: req.query.paginate !== 'false' });
      const baseOptions = {
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
          { model: Report, as: 'report', attributes: ['id', 'title', 'originalName', 'mimeType', 'fileSize'], required: false },
          { model: LabReportTemplate, as: 'template', attributes: ['id', 'name', 'category', 'fields'], required: false },
        ],
        order: [['orderedDate', 'DESC']],
      };
      if (pagination) {
        const queryOptions = applyPaginationOptions(baseOptions, pagination, { forceDistinct: true });
        const tests = await LabTest.findAndCountAll(queryOptions);
        return res.json({
          data: tests.rows,
          meta: buildPaginationMeta(pagination, tests.count),
        });
      }
      const tests = await LabTest.findAll(baseOptions);
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
        { model: Report, as: 'report', required: false },
        { model: LabReportTemplate, as: 'template', required: false },
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

    const payload = normalizeLabTestPayload(req.body);
    if (!payload.labId) return res.status(400).json({ message: 'labId is required' });

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
    const payload = normalizeLabTestPayload(req.body);
    if (payload.status === 'completed' && !payload.completedDate) {
      payload.completedDate = new Date();
    }
    await test.update(payload);
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
