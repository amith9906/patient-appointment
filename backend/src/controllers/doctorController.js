const { Doctor, Hospital, Department, Appointment, Patient, DoctorAvailability, DoctorLeave, IPDAdmission, Vitals, MedicationAdministration } = require('../models');
const { Op } = require('sequelize');
const { ensureScopedHospital, isSuperAdmin, getHODDepartmentId } = require('../utils/accessScope');
const {
  DAY_NAMES,
  toMinutes,
  ensureScheduleForDay,
  buildSlotsFromSchedules,
  fetchSchedules,
} = require('../utils/availability');

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

const ensureDoctorScoped = async (req, res, doctorId) => {
  const scope = await ensureScopedHospital(req, res);
  if (!scope.allowed) return null;
  const doc = await Doctor.findByPk(doctorId, {
    attributes: ['id', 'hospitalId', 'availableDays', 'availableFrom', 'availableTo'],
  });
  if (!doc) {
    res.status(404).json({ message: 'Doctor not found' });
    return null;
  }
  if (!isSuperAdmin(req.user) && doc.hospitalId !== scope.hospitalId) {
    res.status(403).json({ message: 'Access denied for this hospital doctor' });
    return null;
  }
  return doc;
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

exports.getAvailability = async (req, res) => {
  try {
    const doctor = await ensureDoctorScoped(req, res, req.params.id);
    if (!doctor) return;
    const dayOfWeek = Number(req.query.day);
    const where = { doctorId: doctor.id };
    if (!Number.isNaN(dayOfWeek)) where.dayOfWeek = dayOfWeek;
    const rows = await DoctorAvailability.findAll({
      where,
      order: [['dayOfWeek', 'ASC'], ['startTime', 'ASC']],
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.saveAvailability = async (req, res) => {
  try {
    const doctor = await ensureDoctorScoped(req, res, req.params.id);
    if (!doctor) return;
    const rules = Array.isArray(req.body.rules) ? req.body.rules : [];
    const normalized = rules
      .map((rule) => {
        const dayOfWeek = Math.max(0, Math.min(6, Number(rule.dayOfWeek ?? 0)));
        const startTime = String(rule.startTime || '09:00');
        const endTime = String(rule.endTime || '17:00');
        if (!startTime || !endTime) return null;
        const startMinutes = toMinutes(startTime);
        const endMinutes = toMinutes(endTime);
        if (endMinutes <= startMinutes) return null;
        return {
          doctorId: doctor.id,
          dayOfWeek,
          startTime,
          endTime,
          slotDurationMinutes: Math.max(1, Number(rule.slotDurationMinutes || 30)),
          bufferMinutes: Math.max(0, Number(rule.bufferMinutes || 0)),
          maxAppointmentsPerSlot: Math.max(1, Number(rule.maxAppointmentsPerSlot || 1)),
          notes: rule.notes || null,
          isActive: rule.isActive !== false,
        };
      })
      .filter(Boolean);

    await DoctorAvailability.destroy({ where: { doctorId: doctor.id } });
    const created = normalized.length
      ? await DoctorAvailability.bulkCreate(normalized)
      : [];
    res.json(created);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.getAvailabilitySummary = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;
    const targetHospital = req.query.hospitalId || (isSuperAdmin(req.user) ? null : scope.hospitalId);
    const docWhere = {};
    if (targetHospital) docWhere.hospitalId = targetHospital;
    const doctorCount = await Doctor.count({ where: docWhere });

    const availabilityRows = await DoctorAvailability.findAll({
      where: { isActive: true },
      include: [{
        model: Doctor,
        as: 'doctor',
        where: docWhere,
        attributes: [],
        required: true,
      }],
      attributes: ['dayOfWeek'],
      raw: true,
    });
    const rulesByDay = {};
    availabilityRows.forEach((row) => {
      const day = Number.isFinite(Number(row.dayOfWeek)) ? Number(row.dayOfWeek) : 0;
      rulesByDay[day] = (rulesByDay[day] || 0) + 1;
    });

    const leaveWhere = {};
    if (targetHospital) leaveWhere.hospitalId = targetHospital;
    const todayDate = new Date().toISOString().split('T')[0];
    const approvedLeaveWhere = { ...leaveWhere, status: 'approved' };
    const totalLeaves = await DoctorLeave.count({ where: approvedLeaveWhere });
    const leavesToday = await DoctorLeave.count({ where: { ...approvedLeaveWhere, leaveDate: todayDate } });
    const upcomingLeaves = await DoctorLeave.count({ where: { ...approvedLeaveWhere, leaveDate: { [Op.gte]: todayDate } } });

    res.json({
      doctorCount,
      activeRules: availabilityRows.length,
      rulesByDay,
      totalLeaves,
      leavesToday,
      upcomingLeaves,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Returns a Set of doctorIds available on a given date (have schedule + not on full-day leave)
exports.getAvailableOnDate = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { date } = req.query;
    if (!date) return res.status(400).json({ message: 'date is required' });

    const dayOfWeek = new Date(`${date}T00:00:00`).getDay(); // 0=Sun…6=Sat
    const docWhere = isSuperAdmin(req.user) ? {} : { hospitalId: scope.hospitalId };

    // Doctors with an active schedule for this day of week
    const scheduledRows = await DoctorAvailability.findAll({
      where: { dayOfWeek, isActive: true },
      include: [{ model: Doctor, as: 'doctor', where: docWhere, attributes: ['id'], required: true }],
      attributes: ['doctorId'],
      raw: true,
    });
    const availableIds = new Set(scheduledRows.map((r) => r.doctorId));

    // Remove any doctor with a full-day leave on this date
    if (availableIds.size > 0) {
      const fullDayLeaves = await DoctorLeave.findAll({
        where: { doctorId: Array.from(availableIds), leaveDate: date, isFullDay: true, status: 'approved' },
        attributes: ['doctorId'],
        raw: true,
      });
      fullDayLeaves.forEach((l) => availableIds.delete(l.doctorId));
    }

    res.json({ date, dayOfWeek, availableDoctorIds: Array.from(availableIds) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
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
    if (!date) return res.status(400).json({ message: 'date is required' });
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

    const bookedTimes = new Map();
    bookedAppointments.forEach((a) => {
      const key = String(a.appointmentTime || '').slice(0, 5);
      if (!key) return;
      bookedTimes.set(key, (bookedTimes.get(key) || 0) + 1);
    });

    const dayOfWeek = new Date(`${date}T00:00:00`).getDay();
    const dbSchedules = await fetchSchedules(doctor.id, dayOfWeek);
    const schedules = ensureScheduleForDay(doctor, dayOfWeek, dbSchedules);
    if (!schedules.length) return res.json([]);
    const slots = buildSlotsFromSchedules(schedules, bookedTimes);

    const leave = await DoctorLeave.findOne({
      where: { doctorId: doctor.id, leaveDate: date, status: 'approved' },
      attributes: ['isFullDay', 'startTime', 'endTime'],
    });
    if (!leave) return res.json(slots);

    // Reflect approved leave directly in slot availability so UI blocks invalid times.
    if (leave.isFullDay) {
      return res.json(slots.map((slot) => ({ ...slot, available: false })));
    }
    if (leave.startTime && leave.endTime) {
      const leaveStart = toMinutes(String(leave.startTime).slice(0, 5));
      const leaveEnd = toMinutes(String(leave.endTime).slice(0, 5));
      const adjusted = slots.map((slot) => {
        const slotMinutes = toMinutes(String(slot.time || '').slice(0, 5));
        if (slotMinutes >= leaveStart && slotMinutes < leaveEnd) {
          return { ...slot, available: false };
        }
        return slot;
      });
      return res.json(adjusted);
    }
    res.json(slots);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getDepartmentDoctors = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const departmentId = await getHODDepartmentId(req.user);
    if (!departmentId && !isSuperAdmin(req.user)) {
      return res.status(403).json({ message: 'Only HODs can access department-wide data' });
    }

    const where = { isActive: true };
    if (!isSuperAdmin(req.user)) {
      where.departmentId = departmentId;
      where.hospitalId = scope.hospitalId;
    } else if (req.query.departmentId) {
      where.departmentId = req.query.departmentId;
    }

    const doctors = await Doctor.findAll({
      where,
      include: [
        { model: Department, as: 'department', attributes: ['name'] },
        { model: Hospital, as: 'hospital', attributes: ['name'] },
      ],
      order: [['name', 'ASC']],
    });

    res.json(doctors);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getDepartmentStats = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    let departmentId = req.query.departmentId;
    if (!isSuperAdmin(req.user)) {
      departmentId = await getHODDepartmentId(req.user);
    }

    if (!departmentId) {
      return res.status(403).json({ message: 'Department scope required' });
    }

    const doctors = await Doctor.findAll({
      where: { departmentId, isActive: true },
      attributes: ['id', 'name', 'specialization'],
    });

    const docIds = doctors.map(d => d.id);

    const [appointments, admissions, vitalsCount, medicationAdminCount] = await Promise.all([
      Appointment.findAll({
        where: { doctorId: docIds, status: 'completed' },
        attributes: ['doctorId'],
      }),
      IPDAdmission.findAll({
        where: { doctorId: docIds },
        attributes: ['id', 'doctorId', 'status'],
      }),
      Vitals.count({
        where: { admissionId: { [Op.not]: null } },
        include: [{ 
          model: IPDAdmission, 
          as: 'admission', 
          where: { doctorId: docIds } 
        }]
      }),
      MedicationAdministration.count({
        include: [{ 
          model: IPDAdmission, 
          as: 'admission', 
          where: { doctorId: docIds } 
        }]
      }),
    ]);

    const stats = doctors.map(doc => {
      const docAppts = appointments.filter(a => a.doctorId === doc.id).length;
      const docIPD = admissions.filter(a => a.doctorId === doc.id);
      const activeIPD = docIPD.filter(a => a.status === 'admitted').length;
      const totalIPD = docIPD.length;

      return {
        id: doc.id,
        name: doc.name,
        specialization: doc.specialization,
        totalAppointments: docAppts,
        activeAdmissions: activeIPD,
        totalAdmissions: totalIPD,
      };
    });

    res.json({
      departmentId,
      docCount: doctors.length,
      performance: stats,
      summary: {
        totalAppointments: appointments.length,
        totalActiveAdmissions: admissions.filter(a => a.status === 'admitted').length,
      },
      audit: {
        vitalsCount,
        medicationAdminCount,
        complianceScore: Math.round((vitalsCount + medicationAdminCount) / (admissions.length || 1) * 10) / 10
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
