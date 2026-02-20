const { Appointment, Doctor, Patient, Hospital, Prescription, Medication, Vitals } = require('../models');
const { Op } = require('sequelize');
const { ensureScopedHospital, isSuperAdmin } = require('../utils/accessScope');

exports.getAll = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { doctorId, patientId, status, date, from, to } = req.query;
    const where = {};
    if (doctorId) where.doctorId = doctorId;
    if (patientId) where.patientId = patientId;
    if (status) where.status = status;
    if (date) where.appointmentDate = date;
    if (from && to) where.appointmentDate = { [Op.between]: [from, to] };

    const appointments = await Appointment.findAll({
      where,
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

exports.getOne = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const appt = await Appointment.findByPk(req.params.id, {
      include: [
        { model: Doctor, as: 'doctor' },
        { model: Patient, as: 'patient' },
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
            where: { status: 'scheduled' },
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
        Appointment.count({ where: { status: 'scheduled' } }),
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
      range: {
        from: from || null,
        to: to || null,
      },
      doctorWise,
      dayWise,
      weekWise,
      monthWise,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
