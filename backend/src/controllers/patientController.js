const { Patient, Hospital, Appointment, Report, LabTest, Doctor, Vitals, PatientPackage, PackagePlan } = require('../models');
const { Op } = require('sequelize');
const { ensureScopedHospital, isSuperAdmin } = require('../utils/accessScope');
const { ensurePackageAssignable } = require('../utils/packageAssignment');
const { getPaginationParams, buildPaginationMeta, applyPaginationOptions } = require('../utils/pagination');
const round2 = (n) => Number(Number(n || 0).toFixed(2));
const toNullableUuid = (value) => {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized || null;
};
const toArray = (value) => {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.map((x) => String(x || '').trim()).filter(Boolean);
  }
  return [];
};

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
    const packageAssignment = await ensurePackageAssignable(req.body.patientPackageId || null, patient.id, patient.hospitalId);

    const conflict = await Appointment.findOne({
      where: {
        doctorId: req.body.doctorId,
        appointmentDate: req.body.appointmentDate,
        appointmentTime: req.body.appointmentTime,
        status: { [Op.notIn]: ['cancelled', 'no_show'] },
      },
    });
    if (conflict) return res.status(400).json({ message: 'Time slot already booked' });
    const payload = {
      ...req.body,
      patientId: patient.id,
      patientPackageId: packageAssignment ? packageAssignment.id : null,
      corporateAccountId: toNullableUuid(req.body.corporateAccountId),
    };
    const appt = await Appointment.create(payload);
    const full = await Appointment.findByPk(appt.id, {
      include: [
        { model: Doctor, as: 'doctor', attributes: ['id', 'name', 'specialization'] },
        {
          model: PatientPackage,
          as: 'packageAssignment',
          attributes: ['id', 'status', 'usedVisits', 'totalVisits', 'expiryDate'],
          include: [{ model: PackagePlan, as: 'plan', attributes: ['id', 'name', 'serviceType'] }],
        },
      ],
    });
    res.status(201).json(full);
  } catch (err) { res.status(400).json({ message: err.message }); }
};

exports.cancelMyAppointment = async (req, res) => {
  try {
    const patient = await Patient.findOne({ where: { userId: req.user.id } });
    if (!patient) return res.status(404).json({ message: 'Patient profile not found' });

    const appt = await Appointment.findByPk(req.params.id, {
      include: [{ model: Doctor, as: 'doctor', attributes: ['id', 'hospitalId'] }],
    });
    if (!appt || appt.patientId !== patient.id) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    if (appt.doctor?.hospitalId !== patient.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this appointment' });
    }
    if (!['scheduled', 'postponed', 'confirmed'].includes(appt.status)) {
      return res.status(400).json({ message: `Cannot cancel appointment with status "${appt.status}"` });
    }

    const reason = String(req.body?.reason || 'Cancelled by patient').trim();
    await appt.update({ status: 'cancelled', notes: reason || null });
    res.json({ message: 'Appointment cancelled', appointment: appt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.rescheduleMyAppointment = async (req, res) => {
  try {
    const patient = await Patient.findOne({ where: { userId: req.user.id } });
    if (!patient) return res.status(404).json({ message: 'Patient profile not found' });

    const appt = await Appointment.findByPk(req.params.id, {
      include: [{ model: Doctor, as: 'doctor', attributes: ['id', 'hospitalId'] }],
    });
    if (!appt || appt.patientId !== patient.id) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    if (appt.doctor?.hospitalId !== patient.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this appointment' });
    }
    if (!['scheduled', 'postponed', 'confirmed'].includes(appt.status)) {
      return res.status(400).json({ message: `Cannot reschedule appointment with status "${appt.status}"` });
    }

    const appointmentDate = req.body?.appointmentDate;
    const appointmentTime = req.body?.appointmentTime;
    if (!appointmentDate || !appointmentTime) {
      return res.status(400).json({ message: 'appointmentDate and appointmentTime are required' });
    }

    const conflict = await Appointment.findOne({
      where: {
        id: { [Op.ne]: appt.id },
        doctorId: appt.doctorId,
        appointmentDate,
        appointmentTime,
        status: { [Op.notIn]: ['cancelled', 'no_show'] },
      },
    });
    if (conflict) return res.status(400).json({ message: 'Time slot already booked' });

    const prior = `${appt.appointmentDate} ${String(appt.appointmentTime || '').slice(0, 5)}`;
    const next = `${appointmentDate} ${String(appointmentTime).slice(0, 5)}`;
    const existingNotes = String(appt.notes || '').trim();
    const rescheduleNote = `Rescheduled by patient from ${prior} to ${next}`;
    const notes = existingNotes ? `${existingNotes}\n${rescheduleNote}` : rescheduleNote;

    await appt.update({
      appointmentDate,
      appointmentTime,
      status: 'postponed',
      notes,
    });

    res.json({ message: 'Appointment rescheduled', appointment: appt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.getAll = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { hospitalId, search, bloodGroup, referralSource } = req.query;
    const where = { isActive: true };
    if (isSuperAdmin(req.user)) {
      if (hospitalId) where.hospitalId = hospitalId;
    } else {
      where.hospitalId = scope.hospitalId;
    }
    if (bloodGroup) where.bloodGroup = bloodGroup;
    if (referralSource) where.referralSource = referralSource;
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { patientId: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
      ];
    }
    const pagination = getPaginationParams(req, { defaultPerPage: 30, forcePaginate: req.query.paginate !== 'false' });
    const baseOptions = {
      where,
      include: [{ model: Hospital, as: 'hospital', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
    };
    if (pagination) {
      const queryOptions = applyPaginationOptions(baseOptions, pagination, { forceDistinct: true });
      const patients = await Patient.findAndCountAll(queryOptions);
      return res.json({
        data: patients.rows,
        meta: buildPaginationMeta(pagination, patients.count),
      });
    }
    const patients = await Patient.findAll(baseOptions);
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
    const payload = { ...req.body };
    if (!isSuperAdmin(req.user)) payload.hospitalId = scope.hospitalId;
    if (payload.email === '')       payload.email = null;
    if (payload.dateOfBirth === '') payload.dateOfBirth = null;
    if (payload.bloodGroup === '')  payload.bloodGroup = null;
    payload.chronicConditions = toArray(payload.chronicConditions);
    payload.clinicalAlerts = toArray(payload.clinicalAlerts);
    if (!payload.name?.trim()) return res.status(400).json({ message: 'name is required' });
    if (!payload.phone?.trim()) return res.status(400).json({ message: 'phone is required' });
    if (!payload.hospitalId) return res.status(400).json({ message: 'hospitalId is required' });
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
    if (payload.chronicConditions !== undefined) payload.chronicConditions = toArray(payload.chronicConditions);
    if (payload.clinicalAlerts !== undefined) payload.clinicalAlerts = toArray(payload.clinicalAlerts);
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

exports.getReferralAnalytics = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { from, to, referralSource, hospitalId } = req.query;
    const patientWhere = { isActive: true };
    if (isSuperAdmin(req.user)) {
      if (hospitalId) patientWhere.hospitalId = hospitalId;
    } else {
      patientWhere.hospitalId = scope.hospitalId;
    }
    if (referralSource) patientWhere.referralSource = referralSource;
    if (from && to) patientWhere.createdAt = { [Op.between]: [new Date(from), new Date(to)] };
    else if (from) patientWhere.createdAt = { [Op.gte]: new Date(from) };
    else if (to) patientWhere.createdAt = { [Op.lte]: new Date(to) };

    const patients = await Patient.findAll({
      where: patientWhere,
      attributes: ['id', 'referralSource', 'referralDetail', 'createdAt'],
    });

    const patientIds = patients.map((p) => p.id);
    const apptWhere = {};
    if (from && to) apptWhere.appointmentDate = { [Op.between]: [from, to] };
    else if (from) apptWhere.appointmentDate = { [Op.gte]: from };
    else if (to) apptWhere.appointmentDate = { [Op.lte]: to };
    if (patientIds.length > 0) apptWhere.patientId = { [Op.in]: patientIds };
    else apptWhere.patientId = null;

    const appointments = await Appointment.findAll({
      where: apptWhere,
      attributes: ['id', 'patientId', 'doctorId', 'status', 'fee', 'treatmentBill', 'appointmentDate'],
      include: [{ model: Doctor, as: 'doctor', attributes: ['id', 'name'] }],
    });

    const map = new Map();
    const norm = (src) => String(src || 'Unknown').trim() || 'Unknown';

    patients.forEach((p) => {
      const key = norm(p.referralSource);
      if (!map.has(key)) {
        map.set(key, {
          referralSource: key,
          totalPatients: 0,
          appointments: 0,
          confirmed: 0,
          completed: 0,
          cancelled: 0,
          noShow: 0,
          revenue: 0,
        });
      }
      map.get(key).totalPatients += 1;
    });

    const patientSourceById = new Map(patients.map((p) => [p.id, norm(p.referralSource)]));
    appointments.forEach((a) => {
      const key = patientSourceById.get(a.patientId) || 'Unknown';
      if (!map.has(key)) {
        map.set(key, {
          referralSource: key,
          totalPatients: 0,
          appointments: 0,
          confirmed: 0,
          completed: 0,
          cancelled: 0,
          noShow: 0,
          revenue: 0,
        });
      }
      const rec = map.get(key);
      rec.appointments += 1;
      if (a.status === 'confirmed' || a.status === 'in_progress') rec.confirmed += 1;
      if (a.status === 'completed') rec.completed += 1;
      if (a.status === 'cancelled') rec.cancelled += 1;
      if (a.status === 'no_show') rec.noShow += 1;
      rec.revenue += Number(a.fee || 0) + Number(a.treatmentBill || 0);
    });

    const bySource = Array.from(map.values())
      .map((r) => ({
        ...r,
        revenue: round2(r.revenue),
        appointmentToCompletePct: r.appointments > 0 ? round2((r.completed / r.appointments) * 100) : 0,
        patientToAppointmentPct: r.totalPatients > 0 ? round2((r.appointments / r.totalPatients) * 100) : 0,
      }))
      .sort((a, b) => b.completed - a.completed);

    const doctorMap = new Map();
    const doctorMonthMap = new Map();
    appointments.forEach((a) => {
      const src = patientSourceById.get(a.patientId) || 'Unknown';
      const doctorId = a.doctor?.id || 'unknown';
      const doctorName = a.doctor?.name || 'Unknown Doctor';
      const key = `${doctorId}||${src}`;
      if (!doctorMap.has(key)) {
        doctorMap.set(key, {
          doctorId,
          doctorName,
          referralSource: src,
          appointments: 0,
          completed: 0,
          cancelled: 0,
          noShow: 0,
          revenue: 0,
        });
      }
      const rec = doctorMap.get(key);
      rec.appointments += 1;
      if (a.status === 'completed') rec.completed += 1;
      if (a.status === 'cancelled') rec.cancelled += 1;
      if (a.status === 'no_show') rec.noShow += 1;
      rec.revenue += Number(a.fee || 0) + Number(a.treatmentBill || 0);

      const month = String(a.appointmentDate || '').slice(0, 7);
      const monthKey = `${doctorId}||${src}||${month}`;
      if (!doctorMonthMap.has(monthKey)) {
        doctorMonthMap.set(monthKey, {
          doctorId,
          doctorName,
          referralSource: src,
          month,
          appointments: 0,
          completed: 0,
          revenue: 0,
        });
      }
      const mrec = doctorMonthMap.get(monthKey);
      mrec.appointments += 1;
      if (a.status === 'completed') mrec.completed += 1;
      mrec.revenue += Number(a.fee || 0) + Number(a.treatmentBill || 0);
    });

    const byDoctorSource = Array.from(doctorMap.values())
      .map((r) => ({
        ...r,
        revenue: round2(r.revenue),
        conversionPct: r.appointments > 0 ? round2((r.completed / r.appointments) * 100) : 0,
      }))
      .sort((a, b) => b.completed - a.completed);

    const byDoctorSourceMonthly = Array.from(doctorMonthMap.values())
      .map((r) => ({
        ...r,
        revenue: round2(r.revenue),
        conversionPct: r.appointments > 0 ? round2((r.completed / r.appointments) * 100) : 0,
      }))
      .sort((a, b) => String(a.month).localeCompare(String(b.month)));

    const summary = {
      totalSources: bySource.length,
      totalPatients: patients.length,
      totalAppointments: appointments.length,
      totalRevenue: round2(bySource.reduce((s, x) => s + Number(x.revenue || 0), 0)),
      completedAppointments: bySource.reduce((s, x) => s + Number(x.completed || 0), 0),
      cancelledAppointments: bySource.reduce((s, x) => s + Number(x.cancelled || 0), 0),
    };

    res.json({
      summary,
      bySource,
      byDoctorSource,
      byDoctorSourceMonthly,
      range: { from: from || null, to: to || null },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
