const { TreatmentPlan, Patient, Doctor, Hospital } = require('../models');
const { Op } = require('sequelize');
const { ensureScopedHospital, isSuperAdmin } = require('../utils/accessScope');
const { getPaginationParams, buildPaginationMeta, applyPaginationOptions } = require('../utils/pagination');

const INCLUDE = [
  { model: Patient, as: 'patient', attributes: ['id', 'name', 'patientId', 'phone'] },
  { model: Doctor, as: 'doctor', attributes: ['id', 'name', 'specialization'] },
  { model: Hospital, as: 'hospital', attributes: ['id', 'name'] },
];

exports.getAll = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { patientId, doctorId, status, hospitalId: qHospitalId } = req.query;
    const where = {};
    if (isSuperAdmin(req.user)) {
      if (qHospitalId) where.hospitalId = qHospitalId;
    } else {
      where.hospitalId = scope.hospitalId;
    }
    if (patientId) where.patientId = patientId;
    if (doctorId) where.doctorId = doctorId;
    if (status) where.status = status;

      const pagination = getPaginationParams(req, { defaultPerPage: 20, forcePaginate: req.query.paginate !== 'false' });
      const baseOptions = {
        where,
        include: INCLUDE,
        order: [['createdAt', 'DESC']],
      };
      if (pagination) {
        const queryOptions = applyPaginationOptions(baseOptions, pagination, { forceDistinct: true });
        const plans = await TreatmentPlan.findAndCountAll(queryOptions);
        return res.json({
          data: plans.rows,
          meta: buildPaginationMeta(pagination, plans.count),
        });
      }
      const plans = await TreatmentPlan.findAll(baseOptions);
      res.json(plans);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getOne = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const plan = await TreatmentPlan.findByPk(req.params.id, { include: INCLUDE });
    if (!plan) return res.status(404).json({ message: 'Treatment plan not found' });
    if (!isSuperAdmin(req.user) && plan.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    res.json(plan);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.create = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { patientId, doctorId, hospitalId: bodyHospitalId, totalSessions, name } = req.body;
    if (!name) return res.status(400).json({ message: 'Plan name is required' });

    const hospitalId = isSuperAdmin(req.user) ? (bodyHospitalId || scope.hospitalId) : scope.hospitalId;

    const patient = await Patient.findByPk(patientId, { attributes: ['id', 'hospitalId'] });
    if (!patient) return res.status(400).json({ message: 'Patient not found' });
    if (!isSuperAdmin(req.user) && patient.hospitalId !== hospitalId) {
      return res.status(403).json({ message: 'Patient belongs to another hospital' });
    }

    const doctor = await Doctor.findByPk(doctorId, { attributes: ['id', 'hospitalId'] });
    if (!doctor) return res.status(400).json({ message: 'Doctor not found' });
    if (!isSuperAdmin(req.user) && doctor.hospitalId !== hospitalId) {
      return res.status(403).json({ message: 'Doctor belongs to another hospital' });
    }

    // Auto-generate sessions array if not provided
    const n = parseInt(totalSessions) || 1;
    const sessions = req.body.sessions || Array.from({ length: n }, (_, i) => ({
      sessionNo: i + 1,
      name: `Session ${i + 1}`,
      plannedDate: null,
      completedDate: null,
      notes: '',
      cost: 0,
      done: false,
    }));

    const plan = await TreatmentPlan.create({ ...req.body, hospitalId, sessions });
    const full = await TreatmentPlan.findByPk(plan.id, { include: INCLUDE });
    res.status(201).json(full);
  } catch (err) { res.status(400).json({ message: err.message }); }
};

exports.update = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const plan = await TreatmentPlan.findByPk(req.params.id);
    if (!plan) return res.status(404).json({ message: 'Treatment plan not found' });
    if (!isSuperAdmin(req.user) && plan.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Auto-compute completedSessions from sessions array if sessions updated
    const payload = { ...req.body };
    if (payload.sessions) {
      payload.completedSessions = payload.sessions.filter(s => s.done).length;
      if (payload.completedSessions === payload.sessions.length && payload.sessions.length > 0) {
        payload.status = 'completed';
      }
    }

    await plan.update(payload);
    const full = await TreatmentPlan.findByPk(plan.id, { include: INCLUDE });
    res.json(full);
  } catch (err) { res.status(400).json({ message: err.message }); }
};

exports.delete = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const plan = await TreatmentPlan.findByPk(req.params.id);
    if (!plan) return res.status(404).json({ message: 'Treatment plan not found' });
    if (!isSuperAdmin(req.user) && plan.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    await plan.update({ status: 'cancelled' });
    res.json({ message: 'Treatment plan cancelled' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};
