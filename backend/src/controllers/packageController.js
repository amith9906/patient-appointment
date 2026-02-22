const { Op } = require('sequelize');
const { PackagePlan, PatientPackage, Patient, Appointment, User } = require('../models');
const { ensureScopedHospital, isSuperAdmin } = require('../utils/accessScope');

const round2 = (n) => Number(Number(n || 0).toFixed(2));

function resolveHospitalId(req, scope) {
  if (isSuperAdmin(req.user)) return req.query.hospitalId || req.body.hospitalId || req.user.hospitalId || null;
  return scope.hospitalId;
}

exports.getPlans = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;
    const hospitalId = resolveHospitalId(req, scope);
    const where = hospitalId ? { hospitalId } : {};
    if (req.query.isActive === 'true') where.isActive = true;
    if (req.query.isActive === 'false') where.isActive = false;

    const plans = await PackagePlan.findAll({ where, order: [['createdAt', 'DESC']] });
    res.json(plans);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createPlan = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;
    const hospitalId = resolveHospitalId(req, scope);
    if (!hospitalId) return res.status(400).json({ message: 'hospitalId is required for super admin' });

    if (!String(req.body.name || '').trim()) return res.status(400).json({ message: 'name is required' });

    const plan = await PackagePlan.create({
      hospitalId,
      name: String(req.body.name || '').trim(),
      serviceType: req.body.serviceType || 'consultation',
      totalVisits: Number(req.body.totalVisits || 1),
      price: round2(req.body.price || 0),
      validityDays: Number(req.body.validityDays || 30),
      discountType: req.body.discountType || 'none',
      discountValue: round2(req.body.discountValue || 0),
      notes: req.body.notes || null,
      isActive: req.body.isActive !== false,
    });
    res.status(201).json(plan);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.updatePlan = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const plan = await PackagePlan.findByPk(req.params.id);
    if (!plan) return res.status(404).json({ message: 'Package plan not found' });
    if (!isSuperAdmin(req.user) && plan.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital package plan' });
    }

    const payload = { ...req.body };
    if (payload.price !== undefined) payload.price = round2(payload.price);
    if (payload.discountValue !== undefined) payload.discountValue = round2(payload.discountValue);
    if (!isSuperAdmin(req.user)) delete payload.hospitalId;

    await plan.update(payload);
    res.json(plan);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.getPatientAssignments = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const patient = await Patient.findByPk(req.params.patientId, { attributes: ['id', 'hospitalId', 'userId'] });
    if (!patient) return res.status(404).json({ message: 'Patient not found' });
    if (req.user.role === 'patient' && patient.userId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (!isSuperAdmin(req.user) && patient.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital patient' });
    }

    const where = { patientId: patient.id };
    if (req.query.status) where.status = req.query.status;

    const rows = await PatientPackage.findAll({
      where,
      include: [{ model: PackagePlan, as: 'plan' }],
      order: [['createdAt', 'DESC']],
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.assignToPatient = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { patientId, packagePlanId, startDate, notes } = req.body;
    if (!patientId || !packagePlanId) {
      return res.status(400).json({ message: 'patientId and packagePlanId are required' });
    }

    const patient = await Patient.findByPk(patientId, { attributes: ['id', 'hospitalId'] });
    const plan = await PackagePlan.findByPk(packagePlanId);
    if (!patient || !plan) return res.status(404).json({ message: 'Patient or package plan not found' });
    if (patient.hospitalId !== plan.hospitalId) {
      return res.status(400).json({ message: 'Patient and package plan belong to different hospitals' });
    }
    if (!isSuperAdmin(req.user) && patient.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital package assignment' });
    }

    const start = startDate || new Date().toISOString().slice(0, 10);
    const expiry = new Date(`${start}T00:00:00`);
    expiry.setDate(expiry.getDate() + Number(plan.validityDays || 30));

    const assignment = await PatientPackage.create({
      hospitalId: patient.hospitalId,
      patientId: patient.id,
      packagePlanId: plan.id,
      startDate: start,
      expiryDate: expiry.toISOString().slice(0, 10),
      totalVisits: Number(plan.totalVisits || 1),
      usedVisits: 0,
      status: 'active',
      purchaseAmount: round2(plan.price || 0),
      usageHistory: [],
      notes: notes || null,
      createdByUserId: req.user.id,
    });
    const full = await PatientPackage.findByPk(assignment.id, {
      include: [{ model: PackagePlan, as: 'plan' }, { model: Patient, as: 'patient', attributes: ['id', 'name', 'patientId'] }],
    });
    res.status(201).json(full);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.consumeVisit = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const assignment = await PatientPackage.findByPk(req.params.id, {
      include: [{ model: PackagePlan, as: 'plan' }, { model: Patient, as: 'patient', attributes: ['id', 'name', 'patientId'] }],
    });
    if (!assignment) return res.status(404).json({ message: 'Patient package assignment not found' });
    if (!isSuperAdmin(req.user) && assignment.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital package assignment' });
    }
    if (assignment.status !== 'active') return res.status(400).json({ message: `Package is ${assignment.status}` });

    const today = new Date().toISOString().slice(0, 10);
    if (assignment.expiryDate && assignment.expiryDate < today) {
      await assignment.update({ status: 'expired' });
      return res.status(400).json({ message: 'Package has expired' });
    }

    const nextUsed = Number(assignment.usedVisits || 0) + 1;
    if (nextUsed > Number(assignment.totalVisits || 0)) {
      return res.status(400).json({ message: 'No remaining visits in this package' });
    }

    const entry = {
      consumedAt: new Date().toISOString(),
      consumedByUserId: req.user.id,
      appointmentId: req.body.appointmentId || null,
      notes: req.body.notes || null,
    };
    const usageHistory = [...(assignment.usageHistory || []), entry];

    const payload = {
      usedVisits: nextUsed,
      usageHistory,
      status: nextUsed >= Number(assignment.totalVisits || 0) ? 'completed' : 'active',
    };
    await assignment.update(payload);

    if (req.body.appointmentId) {
      const appt = await Appointment.findByPk(req.body.appointmentId);
      if (appt && appt.patientId === assignment.patientId) {
        const existingNotes = String(appt.notes || '').trim();
        const packageNote = `Package used: ${assignment.plan?.name || 'Plan'} (${nextUsed}/${assignment.totalVisits})`;
        await appt.update({
          fee: 0,
          notes: existingNotes ? `${existingNotes}\n${packageNote}` : packageNote,
        });
      }
    }

    res.json({
      message: 'Package visit consumed',
      assignment,
      remainingVisits: Math.max(Number(assignment.totalVisits || 0) - nextUsed, 0),
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.updateAssignmentStatus = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const assignment = await PatientPackage.findByPk(req.params.id);
    if (!assignment) return res.status(404).json({ message: 'Patient package assignment not found' });
    if (!isSuperAdmin(req.user) && assignment.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital package assignment' });
    }

    const status = req.body.status;
    if (!['active', 'completed', 'expired', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    await assignment.update({ status });
    res.json(assignment);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.getAnalytics = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;
    const hospitalId = resolveHospitalId(req, scope);
    const where = hospitalId ? { hospitalId } : {};
    if (req.query.from && req.query.to) where.createdAt = { [Op.between]: [new Date(req.query.from), new Date(req.query.to)] };
    else if (req.query.from) where.createdAt = { [Op.gte]: new Date(req.query.from) };
    else if (req.query.to) where.createdAt = { [Op.lte]: new Date(req.query.to) };

    const rows = await PatientPackage.findAll({
      where,
      include: [{ model: PackagePlan, as: 'plan', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
    });

    const summary = {
      totalAssignments: rows.length,
      activeAssignments: rows.filter((r) => r.status === 'active').length,
      completedAssignments: rows.filter((r) => r.status === 'completed').length,
      expiredAssignments: rows.filter((r) => r.status === 'expired').length,
      totalRevenue: round2(rows.reduce((s, r) => s + Number(r.purchaseAmount || 0), 0)),
      totalVisits: rows.reduce((s, r) => s + Number(r.totalVisits || 0), 0),
      usedVisits: rows.reduce((s, r) => s + Number(r.usedVisits || 0), 0),
    };
    summary.remainingVisits = Math.max(summary.totalVisits - summary.usedVisits, 0);
    summary.utilizationPct = summary.totalVisits > 0 ? round2((summary.usedVisits / summary.totalVisits) * 100) : 0;

    const planMap = new Map();
    rows.forEach((r) => {
      const key = r.plan?.id || 'unknown';
      if (!planMap.has(key)) {
        planMap.set(key, {
          planId: key,
          planName: r.plan?.name || 'Unknown',
          assignments: 0,
          revenue: 0,
          totalVisits: 0,
          usedVisits: 0,
        });
      }
      const rec = planMap.get(key);
      rec.assignments += 1;
      rec.revenue += Number(r.purchaseAmount || 0);
      rec.totalVisits += Number(r.totalVisits || 0);
      rec.usedVisits += Number(r.usedVisits || 0);
    });
    const byPlan = Array.from(planMap.values()).map((r) => ({
      ...r,
      revenue: round2(r.revenue),
      utilizationPct: r.totalVisits > 0 ? round2((r.usedVisits / r.totalVisits) * 100) : 0,
    })).sort((a, b) => b.revenue - a.revenue);

    res.json({ summary, byPlan });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getRecommendation = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const patientId = req.query.patientId;
    const appointmentType = String(req.query.appointmentType || '').trim();
    if (!patientId) return res.status(400).json({ message: 'patientId is required' });

    const patient = await Patient.findByPk(patientId, { attributes: ['id', 'hospitalId'] });
    if (!patient) return res.status(404).json({ message: 'Patient not found' });
    if (!isSuperAdmin(req.user) && patient.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital patient' });
    }

    const today = new Date().toISOString().slice(0, 10);
    const assignments = await PatientPackage.findAll({
      where: {
        patientId,
        hospitalId: patient.hospitalId,
        status: 'active',
        [Op.or]: [{ expiryDate: null }, { expiryDate: { [Op.gte]: today } }],
      },
      include: [{ model: PackagePlan, as: 'plan' }],
      order: [['expiryDate', 'ASC'], ['createdAt', 'ASC']],
    });

    const eligible = assignments
      .map((a) => {
        const total = Number(a.totalVisits || 0);
        const used = Number(a.usedVisits || 0);
        const remaining = Math.max(total - used, 0);
        if (remaining <= 0) return null;
        const planType = String(a.plan?.serviceType || 'custom');
        let fitScore = 1;
        let matchType = 'generic';
        if (appointmentType) {
          if (planType === appointmentType) { fitScore = 4; matchType = 'exact_type_match'; }
          else if (planType === 'custom') { fitScore = 2; matchType = 'custom_plan_match'; }
          else { fitScore = 1; matchType = 'fallback_active_plan'; }
        }
        return { assignment: a, remainingVisits: remaining, fitScore, planType, matchType };
      })
      .filter(Boolean)
      .sort((x, y) => {
        if (y.fitScore !== x.fitScore) return y.fitScore - x.fitScore;
        if (x.remainingVisits !== y.remainingVisits) return x.remainingVisits - y.remainingVisits;
        const xa = String(x.assignment.expiryDate || '9999-12-31');
        const ya = String(y.assignment.expiryDate || '9999-12-31');
        return xa.localeCompare(ya);
      });

    const best = eligible[0] || null;
    if (!best) {
      return res.json({ recommended: null, alternatives: [] });
    }

    const toRow = (item) => ({
      id: item.assignment.id,
      patientId: item.assignment.patientId,
      packagePlanId: item.assignment.packagePlanId,
      status: item.assignment.status,
      startDate: item.assignment.startDate,
      expiryDate: item.assignment.expiryDate,
      totalVisits: item.assignment.totalVisits,
      usedVisits: item.assignment.usedVisits,
      remainingVisits: item.remainingVisits,
      fitScore: item.fitScore,
      matchType: item.matchType,
      recommendationReason: item.matchType === 'exact_type_match'
        ? 'Plan service type matches appointment type'
        : item.matchType === 'custom_plan_match'
          ? 'Custom plan is eligible and active'
          : 'Active plan fallback with remaining visits',
      plan: item.assignment.plan,
    });

    res.json({
      recommended: toRow(best),
      alternatives: eligible.slice(1, 5).map(toRow),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getUsageLog = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const hospitalId = resolveHospitalId(req, scope);
    const where = hospitalId ? { hospitalId } : {};
    if (req.query.patientId) where.patientId = req.query.patientId;
    if (req.query.packagePlanId) where.packagePlanId = req.query.packagePlanId;

    const rows = await PatientPackage.findAll({
      where,
      include: [
        { model: PackagePlan, as: 'plan', attributes: ['id', 'name', 'serviceType'] },
        { model: Patient, as: 'patient', attributes: ['id', 'name', 'patientId'] },
      ],
      order: [['updatedAt', 'DESC']],
    });

    const from = req.query.from ? new Date(`${req.query.from}T00:00:00.000Z`) : null;
    const to = req.query.to ? new Date(`${req.query.to}T23:59:59.999Z`) : null;
    const userId = req.query.userId || null;

    const entries = [];
    const appointmentIds = new Set();
    const userIds = new Set();

    rows.forEach((pkg) => {
      (pkg.usageHistory || []).forEach((u) => {
        const ts = u.consumedAt ? new Date(u.consumedAt) : null;
        if (!ts || Number.isNaN(ts.getTime())) return;
        if (from && ts < from) return;
        if (to && ts > to) return;
        if (userId && String(u.consumedByUserId || '') !== String(userId)) return;

        if (u.appointmentId) appointmentIds.add(u.appointmentId);
        if (u.consumedByUserId) userIds.add(u.consumedByUserId);

        entries.push({
          patientPackageId: pkg.id,
          consumedAt: u.consumedAt,
          consumedByUserId: u.consumedByUserId || null,
          appointmentId: u.appointmentId || null,
          notes: u.notes || null,
          patient: pkg.patient,
          plan: pkg.plan,
        });
      });
    });

    const [appts, users] = await Promise.all([
      appointmentIds.size
        ? Appointment.findAll({
          where: { id: { [Op.in]: Array.from(appointmentIds) } },
          attributes: ['id', 'appointmentNumber', 'appointmentDate', 'appointmentTime'],
        })
        : [],
      userIds.size
        ? User.findAll({
          where: { id: { [Op.in]: Array.from(userIds) } },
          attributes: ['id', 'name', 'email'],
        })
        : [],
    ]);

    const apptMap = new Map((appts || []).map((a) => [a.id, a]));
    const userMap = new Map((users || []).map((u) => [u.id, u]));

    const data = entries
      .map((e) => ({
        ...e,
        appointment: e.appointmentId ? apptMap.get(e.appointmentId) || null : null,
        consumedBy: e.consumedByUserId ? userMap.get(e.consumedByUserId) || null : null,
      }))
      .sort((a, b) => String(b.consumedAt).localeCompare(String(a.consumedAt)));

    res.json({
      summary: {
        totalUsageCount: data.length,
        uniquePatients: new Set(data.map((x) => x.patient?.id).filter(Boolean)).size,
        uniquePlans: new Set(data.map((x) => x.plan?.id).filter(Boolean)).size,
      },
      data,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
