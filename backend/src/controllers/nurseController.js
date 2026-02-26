const crypto = require('crypto');
const { Op, fn, col } = require('sequelize');
const { Nurse, User, Hospital, Department, NursePatientAssignment, IPDAdmission, Patient, Shift, NurseShiftAssignment, NurseLeave, ClinicalNote, Doctor, PasswordOtp } = require('../models');
const { ensureScopedHospital, isSuperAdmin } = require('../utils/accessScope');
const { getPaginationParams, buildPaginationMeta, applyPaginationOptions } = require('../utils/pagination');
const { sendPasswordOtpEmail } = require('../utils/mailer');

exports.getAll = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { departmentId, hospitalId: qHospitalId, isActive } = req.query;
    const where = {};
    if (isSuperAdmin(req.user)) {
      if (qHospitalId) where.hospitalId = qHospitalId;
    } else {
      where.hospitalId = scope.hospitalId;
    }

    if (departmentId) where.departmentId = departmentId;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const pagination = getPaginationParams(req);
    const options = {
      where,
      include: [
        { model: Hospital, as: 'hospital', attributes: ['id', 'name'] },
        { model: Department, as: 'department', attributes: ['id', 'name'] },
        { model: User, as: 'user', attributes: ['id', 'name', 'email', 'role'] },
      ],
      order: [['name', 'ASC']],
    };

    if (pagination) {
      const { rows, count } = await Nurse.findAndCountAll(applyPaginationOptions(options, pagination));
      res.json({
        data: rows,
        meta: buildPaginationMeta(pagination, count),
      });
    } else {
      const nurses = await Nurse.findAll(options);
      res.json(nurses);
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;
    // defensive: ensure required models are available
    const missing = [];
    if (typeof NursePatientAssignment === 'undefined') missing.push('NursePatientAssignment');
    if (typeof IPDAdmission === 'undefined') missing.push('IPDAdmission');
    if (typeof Patient === 'undefined') missing.push('Patient');
    if (typeof Shift === 'undefined') missing.push('Shift');
    if (typeof NurseShiftAssignment === 'undefined') missing.push('NurseShiftAssignment');
    if (typeof NurseLeave === 'undefined') missing.push('NurseLeave');
    if (typeof ClinicalNote === 'undefined') missing.push('ClinicalNote');
    if (typeof Doctor === 'undefined') missing.push('Doctor');
    if (missing.length) {
      console.error('Missing model(s) in nurseController.getOne:', missing);
      return res.status(500).json({ message: `Server misconfiguration: missing models ${missing.join(', ')}` });
    }
    const nurse = await Nurse.findByPk(req.params.id, {
      include: [
        { model: Hospital, as: 'hospital' },
        { model: Department, as: 'department' },
        { model: User, as: 'user', attributes: ['id', 'name', 'email', 'role'] },
      ],
    });

    if (!nurse) return res.status(404).json({ message: 'Nurse not found' });
    if (!isSuperAdmin(req.user) && nurse.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get patient assignments (history)
    const patientAssignments = await NursePatientAssignment.findAll({
      where: { nurseId: nurse.id },
      include: [
        { model: IPDAdmission, as: 'admission', include: [
          { model: Patient, as: 'patient', attributes: ['id', 'name', 'patientId', 'gender', 'dateOfBirth'] },
          { model: Doctor, as: 'doctor', attributes: ['id', 'name', 'departmentId'] },
        ]},
        { model: Shift, as: 'shift', attributes: ['id', 'name', 'startTime', 'endTime'] },
        { model: Doctor, as: 'doctor', attributes: ['id', 'name'] },
      ],
      order: [['assignedAt', 'DESC']],
    });

    // Distinct patients attended
    const patientsMap = new Map();
    const supervisorsMap = new Map();
    for (const pa of patientAssignments) {
      const adm = pa.admission;
      if (adm && adm.patient) patientsMap.set(adm.patient.id, adm.patient);
      if (pa.doctor) supervisorsMap.set(pa.doctor.id, pa.doctor);
      if (adm && adm.doctor) supervisorsMap.set(adm.doctor.id, { id: adm.doctor.id, name: adm.doctor.name });
    }

    const patientsAttended = Array.from(patientsMap.values());
    const supervisors = Array.from(supervisorsMap.values());

    // Shift history
    const shiftHistory = await NurseShiftAssignment.findAll({ where: { nurseId: nurse.id }, include: [{ model: Shift, as: 'shift' }], order: [['date', 'DESC']] });

    // Leaves
    const leaves = await NurseLeave.findAll({ where: { nurseId: nurse.id }, order: [['leaveDate', 'DESC']] });

    // Clinical notes authored by this nurse (authorId is user id)
    const notes = await ClinicalNote.findAll({ where: { authorId: nurse.userId }, include: [{ model: Patient, as: 'patient', attributes: ['id', 'name'] }], order: [['createdAt', 'DESC']] });

    res.json({
      nurse,
      joinedAt: nurse.createdAt,
      departmentHistory: nurse.department ? [nurse.department] : [],
      supervisors,
      patientsAttended,
      patientAssignments,
      shiftHistory,
      leaves,
      clinicalNotes: notes,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const payload = { ...req.body };
    if (!isSuperAdmin(req.user)) {
      payload.hospitalId = scope.hospitalId;
    }

    if (payload.userId === '') payload.userId = null;
    if (payload.departmentId === '') payload.departmentId = null;

    const nurse = await Nurse.create(payload);

    // If nurse has no linked user account but an email is provided, create a User account
    try {
      if (!nurse.userId && nurse.email) {
        // If a user already exists with this email, link it
        let user = await User.findOne({ where: { email: nurse.email } });
        if (!user) {
          // generate a temporary password (will be replaced by OTP flow)
          const tempPass = crypto.randomBytes(6).toString('hex');
          user = await User.create({ name: nurse.name || nurse.email, email: nurse.email, password: tempPass, role: 'nurse', hospitalId: nurse.hospitalId || null });

          // Generate an OTP for password setup and persist it using existing PasswordOtp model
          try {
            const otp = String(Math.floor(100000 + Math.random() * 900000));
            const otpHash = crypto.createHash('sha256').update(String(otp)).digest('hex');
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

            // mark any previous unused otps for this user as used
            await PasswordOtp.update(
              { isUsed: true },
              { where: { userId: user.id, isUsed: false, expiresAt: { [Op.gt]: new Date() } } }
            );

            await PasswordOtp.create({ userId: user.id, email: user.email, otpHash, expiresAt, isUsed: false });

            // send the OTP email (mailer handles dev-mode logging when SMTP isn't configured)
            await sendPasswordOtpEmail(user.email, otp, user.name);
          } catch (mailErr) {
            console.error('Failed to create/send password setup OTP:', mailErr.message || mailErr);
          }
        }
        nurse.userId = user.id;
        await nurse.save();
      }
    } catch (uErr) {
      // don't fail the nurse creation if user linkage fails; log and continue
      console.error('Failed to create/link user for nurse:', uErr.message || uErr);
    }

    res.status(201).json(nurse);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const nurse = await Nurse.findByPk(req.params.id);
    if (!nurse) return res.status(404).json({ message: 'Nurse not found' });
    if (!isSuperAdmin(req.user) && nurse.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const payload = { ...req.body };
    if (payload.userId === '') payload.userId = null;
    if (payload.departmentId === '') payload.departmentId = null;

    await nurse.update(payload);
    res.json(nurse);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const nurse = await Nurse.findByPk(req.params.id);
    if (!nurse) return res.status(404).json({ message: 'Nurse not found' });
    if (!isSuperAdmin(req.user) && nurse.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await nurse.destroy();
    res.json({ message: 'Nurse deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const nurse = await Nurse.findOne({
      where: { userId: req.user.id },
      include: [
        { model: Hospital, as: 'hospital' },
        { model: Department, as: 'department' },
      ],
    });
    if (!nurse) return res.status(404).json({ message: 'Nurse profile not found' });
    res.json(nurse);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/nurses/dashboard
exports.getDashboard = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const hospitalId = isSuperAdmin(req.user) ? req.query.hospitalId || null : scope.hospitalId;
    const departmentId = req.query.departmentId || null;
    const fromDate = req.query.fromDate || null;
    const toDate = req.query.toDate || null;

    const where = {};
    if (hospitalId) where.hospitalId = hospitalId;
    if (departmentId) where.departmentId = departmentId;

    // total nurses
    const total = await Nurse.count({ where });

    // active (isActive true)
    const activeCount = await Nurse.count({ where: { ...where, isActive: true } });

    // determine date range for metrics and series
    const today = new Date();
    const defaultStart = new Date(); defaultStart.setDate(defaultStart.getDate() - 13); // last 14 days
    const startDate = fromDate ? new Date(fromDate) : defaultStart;
    const endDate = toDate ? new Date(toDate) : today;

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // on-leave in range (count distinct nurses on leave for start date)
    const onLeave = await NurseLeave.count({ where: { leaveDate: startStr } });

    // assignments in range (aggregate counts)
    const assignmentsRows = await NurseShiftAssignment.findAll({ where: { date: { [Op.between]: [startStr, endStr] } }, include: [{ model: Nurse, as: 'nurse', where: where, attributes: [] }, { model: Shift, as: 'shift', attributes: ['id','name'] }] });

    // total assignments for start date (single-date summary)
    const assignmentsCount = assignmentsRows.filter(a => a.date && a.date.toISOString().split('T')[0] === startStr).length;

    // by shift distribution for start date
    const byShift = {};
    for (const a of assignmentsRows.filter(a => a.date && a.date.toISOString().split('T')[0] === startStr)) {
      const key = a.shift ? `${a.shift.id}:${a.shift.name}` : 'unknown';
      byShift[key] = (byShift[key] || 0) + 1;
    }

    // build daily time-series for assignments
    const dayMillis = 24 * 60 * 60 * 1000;
    const seriesMap = new Map();
    for (let d = new Date(startStr); d <= new Date(endStr); d = new Date(d.getTime() + dayMillis)) {
      const ds = d.toISOString().split('T')[0];
      seriesMap.set(ds, { date: ds, assignments: 0, newNurses: 0 });
    }

    for (const a of assignmentsRows) {
      const ds = a.date ? a.date.toISOString().split('T')[0] : null;
      if (ds && seriesMap.has(ds)) seriesMap.get(ds).assignments += 1;
    }

    // new nurses per day in range
    const nursesInRange = await Nurse.findAll({ where: { ...where, createdAt: { [Op.between]: [new Date(startStr + 'T00:00:00Z'), new Date(endStr + 'T23:59:59Z')] } }, attributes: ['id','createdAt'] });
    for (const n of nursesInRange) {
      const ds = n.createdAt.toISOString().split('T')[0];
      if (seriesMap.has(ds)) seriesMap.get(ds).newNurses += 1;
    }

    const assignmentsSeries = Array.from(seriesMap.values());

    // nurses per department
    const deptRows = await Nurse.findAll({ where, include: [{ model: Department, as: 'department', attributes: ['id','name'] }] });
    const byDepartment = {};
    for (const n of deptRows) {
      const name = n.department ? n.department.name : 'Unassigned';
      byDepartment[name] = (byDepartment[name] || 0) + 1;
    }

    // unique patients attended in range (metricFrom -> metricTo) or last 30 days if none
    let since;
    if (fromDate && toDate) {
      since = new Date(fromDate);
    } else {
      since = new Date();
      since.setDate(since.getDate() - 30);
    }
    const paRows = await NursePatientAssignment.findAll({ where: { assignedAt: { [Op.gte]: since } }, include: [{ model: IPDAdmission, as: 'admission', include: [{ model: Patient, as: 'patient', attributes: ['id'] }] }] });
    const patientsSet = new Set();
    for (const pa of paRows) if (pa.admission && pa.admission.patient) patientsSet.add(pa.admission.patient.id);

    res.json({
      total,
      active: activeCount,
      onLeave: onLeave,
      assignments: assignmentsCount,
      byShift,
      byDepartment,
      patientsAttended: patientsSet.size,
      assignmentsSeries,
      params: { fromDate: startStr, toDate: endStr, departmentId },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
