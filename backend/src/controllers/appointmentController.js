const {
  Appointment,
  Doctor,
  Patient,
  Hospital,
  Prescription,
  Medication,
  Vitals,
  BillItem,
  CorporateAccount,
} = require('../models');
const { Op } = require('sequelize');
const { ensureScopedHospital, isSuperAdmin } = require('../utils/accessScope');

const CLAIM_TRANSITIONS = {
  na: ['submitted'],
  submitted: ['in_review', 'approved', 'rejected'],
  in_review: ['approved', 'rejected'],
  approved: ['settled', 'rejected'],
  rejected: ['submitted'],
  settled: [],
};

function canTransitionClaimStatus(from, to) {
  if (!to || from === to) return true;
  const allowed = CLAIM_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

exports.getAll = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const {
      doctorId,
      patientId,
      status,
      date,
      from,
      to,
      isPaid,
      patientName,
      patientPhone,
      billingType,
      claimStatus,
    } = req.query;
    const where = {};
    if (doctorId) where.doctorId = doctorId;
    if (patientId) where.patientId = patientId;
    if (status) where.status = status;
    if (billingType) where.billingType = billingType;
    if (claimStatus) where.claimStatus = claimStatus;
    if (isPaid === 'true') where.isPaid = true;
    if (isPaid === 'false') where.isPaid = false;
    if (date) where.appointmentDate = date;
    else if (from && to) where.appointmentDate = { [Op.between]: [from, to] };
    else if (from) where.appointmentDate = { [Op.gte]: from };
    else if (to) where.appointmentDate = { [Op.lte]: to };

    const patientInclude = {
      model: Patient,
      as: 'patient',
      attributes: ['id', 'name', 'patientId', 'phone'],
    };
    if (patientName || patientPhone) {
      const patientWhere = {};
      if (patientName) patientWhere.name = { [Op.iLike]: `%${patientName}%` };
      if (patientPhone) patientWhere.phone = { [Op.iLike]: `%${patientPhone}%` };
      patientInclude.where = patientWhere;
      patientInclude.required = true;
    }

    const appointments = await Appointment.findAll({
      where,
      include: [
        {
          model: Doctor,
          as: 'doctor',
          attributes: ['id', 'name', 'specialization', 'hospitalId'],
          ...(isSuperAdmin(req.user) ? {} : { where: { hospitalId: scope.hospitalId } }),
        },
        patientInclude,
        { model: CorporateAccount, as: 'corporateAccount', attributes: ['id', 'name', 'accountCode', 'creditDays'] },
      ],
      order: [['appointmentDate', 'DESC'], ['appointmentTime', 'DESC']],
    });
    res.json(appointments);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.updateClaim = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const appt = await Appointment.findByPk(req.params.id, {
      include: [{ model: Doctor, as: 'doctor', attributes: ['hospitalId'] }],
    });
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });
    if (!isSuperAdmin(req.user) && appt.doctor?.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital appointment' });
    }

    const nextBillingType = req.body.billingType || appt.billingType || 'self_pay';
    const nextClaimStatus = req.body.claimStatus || appt.claimStatus || 'na';

    if (nextBillingType !== 'insurance' && nextClaimStatus !== 'na') {
      return res.status(400).json({ message: 'Claim status must be na for non-insurance billing type' });
    }

    if (!canTransitionClaimStatus(appt.claimStatus || 'na', nextClaimStatus)) {
      return res.status(400).json({
        message: `Invalid claim transition: ${(appt.claimStatus || 'na')} -> ${nextClaimStatus}`,
      });
    }

    const claimRejectionReason = req.body.claimRejectionReason || null;
    if (nextClaimStatus === 'rejected' && !claimRejectionReason) {
      return res.status(400).json({ message: 'Rejection reason is required when claim is rejected' });
    }

    const approvedAmount = Number(req.body.approvedAmount ?? appt.approvedAmount ?? 0);
    const claimSettlementDate = req.body.claimSettlementDate || appt.claimSettlementDate || null;
    if (nextClaimStatus === 'settled') {
      if (approvedAmount <= 0) {
        return res.status(400).json({ message: 'Approved amount must be greater than 0 before settlement' });
      }
      if (!claimSettlementDate) {
        return res.status(400).json({ message: 'Settlement date is required when claim is settled' });
      }
    }

    let claimDocuments = appt.claimDocuments || [];
    if (req.body.claimDocuments !== undefined) {
      if (!Array.isArray(req.body.claimDocuments)) {
        return res.status(400).json({ message: 'claimDocuments must be an array of references' });
      }
      claimDocuments = req.body.claimDocuments
        .map((x) => String(x || '').trim())
        .filter(Boolean);
    }

    const payload = {
      billingType: nextBillingType,
      insuranceProvider: req.body.insuranceProvider ?? appt.insuranceProvider,
      policyNumber: req.body.policyNumber ?? appt.policyNumber,
      claimNumber: req.body.claimNumber ?? appt.claimNumber,
      claimStatus: nextClaimStatus,
      claimAmount: Number(req.body.claimAmount ?? appt.claimAmount ?? 0),
      approvedAmount,
      claimSubmittedAt: req.body.claimSubmittedAt ?? appt.claimSubmittedAt,
      claimRejectionReason,
      claimSettlementDate: req.body.claimSettlementDate ?? appt.claimSettlementDate,
      claimDocuments,
      notes: req.body.notes ?? appt.notes,
    };

    await appt.update(payload);
    res.json(appt);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const appt = await Appointment.findByPk(req.params.id, {
      include: [
        { model: Doctor, as: 'doctor' },
        { model: Patient, as: 'patient' },
        { model: CorporateAccount, as: 'corporateAccount' },
        { model: Prescription, as: 'prescriptions', include: [{ model: Medication, as: 'medication' }] },
        { model: Vitals, as: 'vitals' },
      ],
    });
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });
    if (!isSuperAdmin(req.user) && appt.doctor?.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital appointment' });
    }
    res.json(appt);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.create = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const doctor = await Doctor.findByPk(req.body.doctorId, { attributes: ['id', 'hospitalId'] });
    if (!doctor) return res.status(400).json({ message: 'Doctor not found' });
    if (!isSuperAdmin(req.user) && doctor.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Doctor belongs to another hospital' });
    }

    const patient = await Patient.findByPk(req.body.patientId, { attributes: ['id', 'hospitalId'] });
    if (!patient) return res.status(400).json({ message: 'Patient not found' });
    if (doctor.hospitalId !== patient.hospitalId) {
      return res.status(400).json({ message: 'Doctor and patient must belong to same hospital' });
    }

    // Check for conflict
    const conflict = await Appointment.findOne({
      where: {
        doctorId: req.body.doctorId,
        appointmentDate: req.body.appointmentDate,
        appointmentTime: req.body.appointmentTime,
        status: { [Op.notIn]: ['cancelled', 'no_show'] },
      },
    });
    if (conflict) return res.status(400).json({ message: 'Time slot already booked' });

    const appt = await Appointment.create(req.body);
    const full = await Appointment.findByPk(appt.id, {
      include: [
        { model: Doctor, as: 'doctor', attributes: ['id', 'name', 'specialization'] },
        { model: Patient, as: 'patient', attributes: ['id', 'name', 'patientId', 'phone'] },
      ],
    });
    res.status(201).json(full);
  } catch (err) { res.status(400).json({ message: err.message }); }
};

exports.update = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const appt = await Appointment.findByPk(req.params.id);
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });

    const doctor = await Doctor.findByPk(appt.doctorId, { attributes: ['hospitalId'] });
    if (!isSuperAdmin(req.user) && doctor?.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital appointment' });
    }

    const nextDoctorId = req.body.doctorId || appt.doctorId;
    const nextDate = req.body.appointmentDate || appt.appointmentDate;
    const nextTime = req.body.appointmentTime || appt.appointmentTime;
    const nextStatus = req.body.status || appt.status;

    if (!['cancelled', 'no_show'].includes(nextStatus)) {
      const conflict = await Appointment.findOne({
        where: {
          id: { [Op.ne]: appt.id },
          doctorId: nextDoctorId,
          appointmentDate: nextDate,
          appointmentTime: nextTime,
          status: { [Op.notIn]: ['cancelled', 'no_show'] },
        },
      });
      if (conflict) return res.status(400).json({ message: 'Time slot already booked' });
    }

    await appt.update(req.body);
    res.json(appt);
  } catch (err) { res.status(400).json({ message: err.message }); }
};

exports.cancel = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const appt = await Appointment.findByPk(req.params.id);
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });

    const doctor = await Doctor.findByPk(appt.doctorId, { attributes: ['hospitalId'] });
    if (!isSuperAdmin(req.user) && doctor?.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital appointment' });
    }

    await appt.update({ status: 'cancelled', notes: req.body.reason });
    res.json({ message: 'Appointment cancelled', appointment: appt });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getTodayAppointments = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const today = new Date().toISOString().split('T')[0];
    const appointments = await Appointment.findAll({
      where: {
        appointmentDate: today,
        status: { [Op.notIn]: ['cancelled'] },
      },
      include: [
        {
          model: Doctor,
          as: 'doctor',
          attributes: ['id', 'name', 'specialization', 'hospitalId'],
          ...(isSuperAdmin(req.user) ? {} : { where: { hospitalId: scope.hospitalId } }),
        },
        { model: Patient, as: 'patient', attributes: ['id', 'name', 'patientId', 'phone'] },
      ],
      order: [['appointmentDate', 'DESC'], ['appointmentTime', 'DESC']],
    });
    res.json(appointments);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getQueue = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const today = new Date().toISOString().split('T')[0];
    const queueDate = req.query.date || today;
    const { doctorId } = req.query;
    const queueStatuses = ['scheduled', 'postponed', 'confirmed', 'in_progress'];

    const where = {
      appointmentDate: queueDate,
      status: { [Op.in]: queueStatuses },
    };
    if (doctorId) where.doctorId = doctorId;

    const doctorInclude = {
      model: Doctor,
      as: 'doctor',
      attributes: ['id', 'name', 'specialization', 'hospitalId'],
      ...(isSuperAdmin(req.user) ? {} : { where: { hospitalId: scope.hospitalId } }),
    };

    const appointments = await Appointment.findAll({
      where,
      include: [
        doctorInclude,
        { model: Patient, as: 'patient', attributes: ['id', 'name', 'patientId', 'phone'] },
      ],
      order: [['appointmentTime', 'ASC'], ['createdAt', 'ASC']],
    });

    const items = appointments.map((appt, idx) => ({
      ...appt.toJSON(),
      queueToken: idx + 1,
    }));

    res.json({
      date: queueDate,
      total: items.length,
      items,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.checkIn = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const appt = await Appointment.findByPk(req.params.id, {
      include: [{ model: Doctor, as: 'doctor', attributes: ['id', 'hospitalId'] }],
    });
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });
    if (!isSuperAdmin(req.user) && appt.doctor?.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital appointment' });
    }

    if (['cancelled', 'completed', 'no_show'].includes(appt.status)) {
      return res.status(400).json({ message: `Cannot check in an appointment with status "${appt.status}"` });
    }

    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const stamp = `${hh}:${mm}`;
    const existingNotes = String(appt.notes || '').trim();
    const checkedInTag = `Checked in at ${stamp}`;
    const noteSuffix = req.body?.note ? ` - ${String(req.body.note).trim()}` : '';
    const nextNotes = existingNotes
      ? `${existingNotes}\n${checkedInTag}${noteSuffix}`
      : `${checkedInTag}${noteSuffix}`;

    const nextStatus = ['scheduled', 'postponed'].includes(appt.status) ? 'confirmed' : appt.status;
    await appt.update({ status: nextStatus, notes: nextNotes });

    const queueItems = await Appointment.findAll({
      where: {
        appointmentDate: appt.appointmentDate,
        doctorId: appt.doctorId,
        status: { [Op.in]: ['scheduled', 'postponed', 'confirmed', 'in_progress'] },
      },
      order: [['appointmentTime', 'ASC'], ['createdAt', 'ASC']],
      attributes: ['id'],
    });
    const queuePosition = queueItems.findIndex((x) => x.id === appt.id) + 1;

    res.json({
      message: 'Patient checked in successfully',
      appointment: appt,
      queuePosition: queuePosition > 0 ? queuePosition : null,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const today = new Date().toISOString().split('T')[0];
    const { Patient, Doctor, Hospital } = require('../models');

    if (!isSuperAdmin(req.user)) {
      const hospitalId = scope.hospitalId;
      const [totalPatients, totalDoctors, todayAppts, pendingAppts, completedToday] =
        await Promise.all([
          Patient.count({ where: { isActive: true, hospitalId } }),
          Doctor.count({ where: { isActive: true, hospitalId } }),
          Appointment.count({
            where: { appointmentDate: today },
            include: [{ model: Doctor, as: 'doctor', where: { hospitalId } }],
          }),
          Appointment.count({
            where: { status: { [Op.in]: ['scheduled', 'postponed'] } },
            include: [{ model: Doctor, as: 'doctor', where: { hospitalId } }],
          }),
          Appointment.count({
            where: { appointmentDate: today, status: 'completed' },
            include: [{ model: Doctor, as: 'doctor', where: { hospitalId } }],
          }),
        ]);

      return res.json({ totalPatients, totalDoctors, totalHospitals: 1, todayAppts, pendingAppts, completedToday });
    }

    const [totalPatients, totalDoctors, totalHospitals, todayAppts, pendingAppts, completedToday] =
      await Promise.all([
        Patient.count({ where: { isActive: true } }),
        Doctor.count({ where: { isActive: true } }),
        Hospital.count({ where: { isActive: true } }),
        Appointment.count({ where: { appointmentDate: today } }),
        Appointment.count({ where: { status: { [Op.in]: ['scheduled', 'postponed'] } } }),
        Appointment.count({ where: { appointmentDate: today, status: 'completed' } }),
      ]);

    res.json({ totalPatients, totalDoctors, totalHospitals, todayAppts, pendingAppts, completedToday });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getBillingAnalytics = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { from, to } = req.query;
    const where = { status: { [Op.notIn]: ['cancelled', 'no_show'] } };
    if (from && to) where.appointmentDate = { [Op.between]: [from, to] };
    else if (from) where.appointmentDate = { [Op.gte]: from };
    else if (to) where.appointmentDate = { [Op.lte]: to };

    const includeDoctor = {
      model: Doctor,
      as: 'doctor',
      attributes: ['id', 'name', 'hospitalId'],
      ...(isSuperAdmin(req.user) ? {} : { where: { hospitalId: scope.hospitalId } }),
    };

    const appointments = await Appointment.findAll({
      where,
      include: [includeDoctor],
      order: [['appointmentDate', 'DESC'], ['appointmentTime', 'DESC']],
    });

    const billedAppointments = appointments.filter((a) => (Number(a.fee || 0) + Number(a.treatmentBill || 0)) > 0);

    const totalBills = billedAppointments.length;
    const totalConsultationAmount = billedAppointments.reduce((sum, item) => sum + Number(item.fee || 0), 0);
    const totalTreatmentAmount = billedAppointments.reduce((sum, item) => sum + Number(item.treatmentBill || 0), 0);
    const totalAmount = totalConsultationAmount + totalTreatmentAmount;
    const paidAmount = billedAppointments
      .filter((item) => item.isPaid)
      .reduce((sum, item) => sum + Number(item.fee || 0) + Number(item.treatmentBill || 0), 0);
    const pendingAmount = totalAmount - paidAmount;
    const insuranceAppointments = billedAppointments.filter((item) => item.billingType === 'insurance');
    const submittedClaims = insuranceAppointments.filter((item) => ['submitted', 'in_review', 'approved', 'settled'].includes(item.claimStatus));
    const approvedClaims = insuranceAppointments.filter((item) => ['approved', 'settled'].includes(item.claimStatus));
    const settledClaims = insuranceAppointments.filter((item) => item.claimStatus === 'settled');
    const totalClaimAmount = insuranceAppointments.reduce((sum, item) => sum + Number(item.claimAmount || 0), 0);
    const totalApprovedAmount = insuranceAppointments.reduce((sum, item) => sum + Number(item.approvedAmount || 0), 0);

    const doctorMap = new Map();
    billedAppointments.forEach((item) => {
      const doctorId = item.doctor?.id || 'unknown';
      const doctorName = item.doctor?.name || 'Unknown Doctor';
      if (!doctorMap.has(doctorId)) {
        doctorMap.set(doctorId, {
          doctorId,
          doctorName,
          bills: 0,
          amount: 0,
          consultationAmount: 0,
          treatmentAmount: 0,
          paidAmount: 0,
          pendingAmount: 0,
        });
      }
      const record = doctorMap.get(doctorId);
      const consultationFee = Number(item.fee || 0);
      const treatmentFee = Number(item.treatmentBill || 0);
      const totalFee = consultationFee + treatmentFee;
      record.bills += 1;
      record.consultationAmount += consultationFee;
      record.treatmentAmount += treatmentFee;
      record.amount += totalFee;
      if (item.isPaid) record.paidAmount += totalFee;
      else record.pendingAmount += totalFee;
    });

    const doctorWise = Array.from(doctorMap.values())
      .map((item) => ({
        ...item,
        collectionRate: item.amount > 0 ? Number(((item.paidAmount / item.amount) * 100).toFixed(2)) : 0,
        contributionPct: totalAmount > 0 ? Number(((item.amount / totalAmount) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const dayWiseMap = new Map();
    const weekWiseMap = new Map();
    const monthWiseMap = new Map();

    const isoWeekKey = (dateObj) => {
      const date = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()));
      const dayNum = date.getUTCDay() || 7;
      date.setUTCDate(date.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
      return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
    };

    billedAppointments.forEach((item) => {
      const consultationFee = Number(item.fee || 0);
      const treatmentFee = Number(item.treatmentBill || 0);
      const fee = consultationFee + treatmentFee;
      const dateObj = new Date(item.appointmentDate);
      const dayKey = item.appointmentDate;
      const weekKey = isoWeekKey(dateObj);
      const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;

      if (!dayWiseMap.has(dayKey)) dayWiseMap.set(dayKey, { date: dayKey, bills: 0, amount: 0, consultationAmount: 0, treatmentAmount: 0, paidAmount: 0, pendingAmount: 0 });
      if (!weekWiseMap.has(weekKey)) weekWiseMap.set(weekKey, { week: weekKey, bills: 0, amount: 0, consultationAmount: 0, treatmentAmount: 0, paidAmount: 0, pendingAmount: 0 });
      if (!monthWiseMap.has(monthKey)) monthWiseMap.set(monthKey, { month: monthKey, bills: 0, amount: 0, consultationAmount: 0, treatmentAmount: 0, paidAmount: 0, pendingAmount: 0 });

      dayWiseMap.get(dayKey).bills += 1;
      dayWiseMap.get(dayKey).amount += fee;
      dayWiseMap.get(dayKey).consultationAmount += consultationFee;
      dayWiseMap.get(dayKey).treatmentAmount += treatmentFee;
      weekWiseMap.get(weekKey).bills += 1;
      weekWiseMap.get(weekKey).amount += fee;
      weekWiseMap.get(weekKey).consultationAmount += consultationFee;
      weekWiseMap.get(weekKey).treatmentAmount += treatmentFee;
      monthWiseMap.get(monthKey).bills += 1;
      monthWiseMap.get(monthKey).amount += fee;
      monthWiseMap.get(monthKey).consultationAmount += consultationFee;
      monthWiseMap.get(monthKey).treatmentAmount += treatmentFee;
      if (item.isPaid) {
        dayWiseMap.get(dayKey).paidAmount += fee;
        weekWiseMap.get(weekKey).paidAmount += fee;
        monthWiseMap.get(monthKey).paidAmount += fee;
      } else {
        dayWiseMap.get(dayKey).pendingAmount += fee;
        weekWiseMap.get(weekKey).pendingAmount += fee;
        monthWiseMap.get(monthKey).pendingAmount += fee;
      }
    });

    const dayWise = Array.from(dayWiseMap.values())
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-14)
      .map((x) => ({ ...x, label: new Date(x.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }));

    const weekWise = Array.from(weekWiseMap.values())
      .sort((a, b) => a.week.localeCompare(b.week))
      .slice(-12)
      .map((x) => ({ ...x, label: x.week }));

    const monthWise = Array.from(monthWiseMap.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12)
      .map((x) => {
        const [year, month] = x.month.split('-').map(Number);
        const label = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        return { ...x, label };
      });

    // Category-wise breakdown from BillItem table
    const billedApptIds = billedAppointments.map(a => a.id);
    const categoryMap = new Map();
    if (billedApptIds.length > 0) {
      const billItems = await BillItem.findAll({ where: { appointmentId: billedApptIds } });
      billItems.forEach(item => {
        const cat = item.category || 'other';
        if (!categoryMap.has(cat)) categoryMap.set(cat, { category: cat, total: 0, count: 0 });
        const rec = categoryMap.get(cat);
        rec.total += Number(item.amount || 0);
        rec.count += 1;
      });
    }
    // Add consultation fee as a synthetic category entry
    if (totalConsultationAmount > 0) {
      categoryMap.set('consultation', {
        category: 'consultation',
        total: parseFloat(totalConsultationAmount.toFixed(2)),
        count: billedAppointments.filter(a => Number(a.fee || 0) > 0).length,
      });
    }
    const categoryWise = Array.from(categoryMap.values())
      .map(c => ({ ...c, total: parseFloat(c.total.toFixed(2)) }))
      .sort((a, b) => b.total - a.total);

    res.json({
      summary: {
        totalBills,
        totalAmount,
        totalConsultationAmount,
        totalTreatmentAmount,
        paidAmount,
        pendingAmount,
      },
      overallRevenue: {
        totalAmount,
        totalConsultationAmount,
        totalTreatmentAmount,
        paidAmount,
        pendingAmount,
        collectionRate: totalAmount > 0 ? Number(((paidAmount / totalAmount) * 100).toFixed(2)) : 0,
      },
      claimSummary: {
        totalInsuranceBills: insuranceAppointments.length,
        submittedClaims: submittedClaims.length,
        approvedClaims: approvedClaims.length,
        settledClaims: settledClaims.length,
        totalClaimAmount: Number(totalClaimAmount.toFixed(2)),
        totalApprovedAmount: Number(totalApprovedAmount.toFixed(2)),
      },
      range: {
        from: from || null,
        to: to || null,
      },
      doctorWise,
      dayWise,
      weekWise,
      monthWise,
      categoryWise,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getPatientAnalytics = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { from, to } = req.query;
    const where = {};
    if (from && to) where.appointmentDate = { [Op.between]: [from, to] };
    else if (from)  where.appointmentDate = { [Op.gte]: from };
    else if (to)    where.appointmentDate = { [Op.lte]: to };

    // Hospital scoping goes through Doctor (same pattern as getAll / getBillingAnalytics)
    const doctorInclude = {
      model: Doctor,
      as: 'doctor',
      attributes: ['id', 'specialization', 'hospitalId'],
      ...(isSuperAdmin(req.user) ? {} : { where: { hospitalId: scope.hospitalId } }),
    };

    // All appointments in range
    const appts = await Appointment.findAll({
      where,
      attributes: ['id', 'patientId', 'appointmentDate', 'type', 'diagnosis'],
      include: [doctorInclude],
      order: [['appointmentDate', 'ASC']],
    });

    // Hospital name map for super_admin
    let hospitalNameMap = {};
    if (isSuperAdmin(req.user)) {
      const hospitals = await Hospital.findAll({ attributes: ['id', 'name'] });
      for (const h of hospitals) hospitalNameMap[h.id] = h.name;
    }

    if (!appts.length) {
      return res.json({
        summary: { totalAppointments: 0, totalUniquePatients: 0, newPatients: 0, returningPatients: 0, retentionRate: 0 },
        newVsReturningByMonth: [],
        newVsReturningByWeek: [],
        byDepartment: [],
        byDeptMonth: [],
        topDiagnoses: [],
        byTypeMonth: [],
        byHospital: [],
        top5Depts: [],
        range: { from: from || null, to: to || null },
      });
    }

    const rangeStart = from ? new Date(from) : null;

    // Determine first-ever appointment date for each patient (all-time, hospital scoped)
    const allPatientAppts = await Appointment.findAll({
      attributes: ['patientId', 'appointmentDate'],
      include: [{
        model: Doctor,
        as: 'doctor',
        attributes: ['hospitalId'],
        ...(isSuperAdmin(req.user) ? {} : { where: { hospitalId: scope.hospitalId } }),
      }],
      order: [['appointmentDate', 'ASC']],
    });
    const firstVisitMap = {};
    for (const a of allPatientAppts) {
      if (!firstVisitMap[a.patientId]) firstVisitMap[a.patientId] = a.appointmentDate;
    }

    // Label each appointment's patient as new/returning within this range
    const seen = new Set();
    let newCount = 0, returningCount = 0;
    const uniquePatients = new Set();

    // Monthly buckets
    const monthMap = {};
    const weekMap  = {};
    const deptMap  = {};
    const deptMonthMap  = {};
    const diagMap  = {};
    const typeMonthMap  = {};

    for (const a of appts) {
      uniquePatients.add(a.patientId);
      const apptDate  = new Date(a.appointmentDate);
      const monthKey  = `${apptDate.getFullYear()}-${String(apptDate.getMonth()+1).padStart(2,'0')}`;
      const weekStart = new Date(apptDate);
      weekStart.setDate(apptDate.getDate() - apptDate.getDay());
      const weekKey   = weekStart.toISOString().slice(0,10);

      // New vs returning: "new" = first ever appointment is within range
      const firstEver = firstVisitMap[a.patientId];
      const isNew = rangeStart ? (firstEver && new Date(firstEver) >= rangeStart) : true;

      if (!seen.has(a.patientId)) {
        seen.add(a.patientId);
        if (isNew) newCount++; else returningCount++;
      }

      // Month buckets
      if (!monthMap[monthKey]) monthMap[monthKey] = { month: monthKey, new: 0, returning: 0 };
      if (isNew) monthMap[monthKey].new++; else monthMap[monthKey].returning++;

      // Week buckets
      if (!weekMap[weekKey]) weekMap[weekKey] = { week: weekKey, new: 0, returning: 0 };
      if (isNew) weekMap[weekKey].new++; else weekMap[weekKey].returning++;

      // Department (specialization)
      const dept = a.doctor?.specialization || 'General';
      if (!deptMap[dept]) deptMap[dept] = { department: dept, count: 0 };
      deptMap[dept].count++;

      const deptMonthKey = `${dept}__${monthKey}`;
      if (!deptMonthMap[deptMonthKey]) deptMonthMap[deptMonthKey] = { department: dept, month: monthKey, count: 0 };
      deptMonthMap[deptMonthKey].count++;

      // Diagnoses
      if (a.diagnosis) {
        const parts = a.diagnosis.split(/[,;/|]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
        for (const d of parts) {
          if (d.length < 2) continue;
          if (!diagMap[d]) diagMap[d] = { diagnosis: d, count: 0, byMonth: {} };
          diagMap[d].count++;
          if (!diagMap[d].byMonth[monthKey]) diagMap[d].byMonth[monthKey] = 0;
          diagMap[d].byMonth[monthKey]++;
        }
      }

      // Appointment type by month
      const type = a.type || 'consultation';
      const tmKey = `${type}__${monthKey}`;
      if (!typeMonthMap[tmKey]) typeMonthMap[tmKey] = { type, month: monthKey, count: 0 };
      typeMonthMap[tmKey].count++;
    }

    // Top 5 departments
    const sortedDepts = Object.values(deptMap).sort((a,b) => b.count - a.count);
    const top5Depts   = sortedDepts.slice(0,5).map(d => d.department);

    // Department by month — only top 5
    const allMonths = [...new Set(Object.keys(monthMap))].sort();
    const byDeptMonth = top5Depts.map(dept => ({
      department: dept,
      data: allMonths.map(m => ({
        month: m,
        count: deptMonthMap[`${dept}__${m}`]?.count || 0,
      })),
    }));

    // Top 15 diagnoses
    const topDiagnoses = Object.values(diagMap)
      .sort((a,b) => b.count - a.count)
      .slice(0,15)
      .map(d => ({
        diagnosis: d.diagnosis,
        count: d.count,
        byMonth: allMonths.map(m => ({ month: m, count: d.byMonth[m] || 0 })),
      }));

    // Appointment type by month flattened
    const byTypeMonth = Object.values(typeMonthMap).sort((a,b) => a.month.localeCompare(b.month) || a.type.localeCompare(b.type));

    // Hospital summary (super_admin only)
    let byHospital = [];
    if (isSuperAdmin(req.user)) {
      const hospMap = {};
      for (const a of appts) {
        const hid = a.doctor?.hospitalId;
        if (!hid) continue;
        if (!hospMap[hid]) hospMap[hid] = { hospitalId: hid, name: hospitalNameMap[hid] || hid, count: 0 };
        hospMap[hid].count++;
      }
      byHospital = Object.values(hospMap).sort((a,b) => b.count - a.count);
    }

    res.json({
      summary: {
        totalAppointments: appts.length,
        totalUniquePatients: uniquePatients.size,
        newPatients: newCount,
        returningPatients: returningCount,
        retentionRate: uniquePatients.size > 0 ? Number(((returningCount / uniquePatients.size) * 100).toFixed(1)) : 0,
      },
      newVsReturningByMonth: Object.values(monthMap).sort((a,b) => a.month.localeCompare(b.month)),
      newVsReturningByWeek:  Object.values(weekMap).sort((a,b) => a.week.localeCompare(b.week)),
      byDepartment: sortedDepts,
      byDeptMonth,
      topDiagnoses,
      byTypeMonth,
      byHospital,
      top5Depts,
      range: { from: from || null, to: to || null },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
