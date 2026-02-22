const { Op } = require('sequelize');
const { OTSchedule, Patient, Doctor, Hospital, IPDAdmission } = require('../models');
const { ensureScopedHospital, isSuperAdmin } = require('../utils/accessScope');
const { getPaginationParams, buildPaginationMeta, applyPaginationOptions } = require('../utils/pagination');

function buildHospitalFilter(req, scope, queryHospitalId) {
  if (isSuperAdmin(req.user)) {
    return queryHospitalId ? { hospitalId: queryHospitalId } : {};
  }
  return { hospitalId: scope.hospitalId };
}

const HOSPITAL_INCLUDE = { model: Hospital, as: 'hospital', attributes: ['id', 'name'] };

exports.getStats = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const today = new Date().toISOString().slice(0, 10);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const hf = buildHospitalFilter(req, scope, req.query.hospitalId);

    const [scheduledToday, inProgress, completedThisMonth, cancelledThisMonth] = await Promise.all([
      OTSchedule.count({ where: { ...hf, scheduledDate: today, status: 'scheduled' } }),
      OTSchedule.count({ where: { ...hf, status: 'in_progress' } }),
      OTSchedule.count({ where: { ...hf, status: 'completed', scheduledDate: { [Op.gte]: monthStart } } }),
      OTSchedule.count({ where: { ...hf, status: 'cancelled', scheduledDate: { [Op.gte]: monthStart } } }),
    ]);
    res.json({ scheduledToday, inProgress, completedThisMonth, cancelledThisMonth });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAll = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { status, date, from, to, surgeonId, patientId, hospitalId: qHospitalId } = req.query;
    const where = { ...buildHospitalFilter(req, scope, qHospitalId) };
    if (status) where.status = status;
    if (surgeonId) where.surgeonId = surgeonId;
    if (patientId) where.patientId = patientId;
    if (date) where.scheduledDate = date;
    else if (from || to) {
      where.scheduledDate = {};
      if (from) where.scheduledDate[Op.gte] = from;
      if (to) where.scheduledDate[Op.lte] = to;
    }
      const pagination = getPaginationParams(req, { defaultPerPage: 15, forcePaginate: req.query.paginate !== 'false' });
      const baseOptions = {
        where,
        include: [
          { model: Patient, as: 'patient', attributes: ['id', 'name', 'patientId', 'phone'] },
          { model: Doctor, as: 'surgeon', attributes: ['id', 'name', 'specialization'] },
          ...(isSuperAdmin(req.user) ? [HOSPITAL_INCLUDE] : []),
        ],
        order: [['scheduledDate', 'DESC'], ['scheduledTime', 'ASC']],
      };
      if (pagination) {
        const queryOptions = applyPaginationOptions(baseOptions, pagination, { forceDistinct: true });
        const schedules = await OTSchedule.findAndCountAll(queryOptions);
        return res.json({
          data: schedules.rows,
          meta: buildPaginationMeta(pagination, schedules.count),
        });
      }
      const schedules = await OTSchedule.findAll(baseOptions);
      res.json(schedules);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const schedule = await OTSchedule.findByPk(req.params.id, {
      include: [
        { model: Patient, as: 'patient', attributes: ['id', 'name', 'patientId', 'phone', 'dateOfBirth', 'gender', 'bloodGroup', 'allergies'] },
        { model: Doctor, as: 'surgeon', attributes: ['id', 'name', 'specialization', 'phone'] },
        { model: IPDAdmission, as: 'admission', attributes: ['id', 'admissionNumber', 'admissionDate', 'admissionDiagnosis'] },
        HOSPITAL_INCLUDE,
      ],
    });
    if (!schedule) return res.status(404).json({ message: 'OT schedule not found' });
    if (!isSuperAdmin(req.user) && schedule.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    res.json(schedule);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const hospitalId = isSuperAdmin(req.user) ? (req.body.hospitalId || null) : scope.hospitalId;
    if (!hospitalId) return res.status(400).json({ message: 'hospitalId is required' });

    const { patientId, surgeonId, procedureName, scheduledDate, scheduledTime, estimatedDuration, otRoom, anesthesiaType, admissionId, preOpNotes } = req.body;
    if (!patientId || !surgeonId || !procedureName || !scheduledDate || !scheduledTime) {
      return res.status(400).json({ message: 'patientId, surgeonId, procedureName, scheduledDate, scheduledTime are required' });
    }
    const [patient, doctor] = await Promise.all([
      Patient.findOne({ where: { id: patientId, hospitalId } }),
      Doctor.findOne({ where: { id: surgeonId, hospitalId } }),
    ]);
    if (!patient) return res.status(404).json({ message: 'Patient not found in this hospital' });
    if (!doctor) return res.status(404).json({ message: 'Surgeon not found in this hospital' });

    const schedule = await OTSchedule.create({
      hospitalId, patientId, surgeonId, procedureName, scheduledDate, scheduledTime,
      estimatedDuration: estimatedDuration || 60, otRoom, anesthesiaType,
      admissionId: admissionId || null, preOpNotes,
    });
    res.status(201).json(schedule);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const schedule = await OTSchedule.findByPk(req.params.id);
    if (!schedule) return res.status(404).json({ message: 'OT schedule not found' });
    if (!isSuperAdmin(req.user) && schedule.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    // Coerce empty strings to null for timestamp fields
    const payload = { ...req.body };
    if (payload.actualStartTime === '') payload.actualStartTime = null;
    if (payload.actualEndTime === '') payload.actualEndTime = null;
    await schedule.update(payload);
    res.json(schedule);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.cancel = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const schedule = await OTSchedule.findByPk(req.params.id);
    if (!schedule) return res.status(404).json({ message: 'OT schedule not found' });
    if (!isSuperAdmin(req.user) && schedule.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (schedule.status === 'cancelled') return res.status(400).json({ message: 'Already cancelled' });
    await schedule.update({ status: 'cancelled' });
    res.json(schedule);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
