const fs = require('fs');
const { Report, Patient, Appointment } = require('../models');
const { ensureScopedHospital, isSuperAdmin } = require('../utils/accessScope');
const { getPaginationParams, buildPaginationMeta, applyPaginationOptions } = require('../utils/pagination');

const resolvePatientProfile = async (userId) => Patient.findOne({
  where: { userId },
  attributes: ['id', 'hospitalId'],
});

async function canAccessPatient(req, res, patientId) {
  if (req.user.role === 'patient') {
    const myPatient = await resolvePatientProfile(req.user.id);
    if (!myPatient) {
      res.status(403).json({ message: 'Patient profile not found' });
      return null;
    }
    if (myPatient.id !== patientId) {
      res.status(403).json({ message: 'Access denied for this patient' });
      return null;
    }
    return { hospitalId: myPatient.hospitalId };
  }

  const scope = await ensureScopedHospital(req, res);
  if (!scope.allowed) return null;

  const patient = await Patient.findByPk(patientId, { attributes: ['id', 'hospitalId'] });
  if (!patient) {
    res.status(404).json({ message: 'Patient not found' });
    return null;
  }
  if (!isSuperAdmin(req.user) && patient.hospitalId !== scope.hospitalId) {
    res.status(403).json({ message: 'Access denied for this hospital patient' });
    return null;
  }
  return { hospitalId: patient.hospitalId };
}

async function canAccessReport(req, res, reportId) {
  const report = await Report.findByPk(reportId, {
    include: [{ model: Patient, as: 'patient', attributes: ['id', 'hospitalId', 'userId'] }],
  });
  if (!report) {
    res.status(404).json({ message: 'Report not found' });
    return null;
  }

  if (req.user.role === 'patient') {
    if (!report.patient || report.patient.userId !== req.user.id) {
      res.status(403).json({ message: 'Access denied for this report' });
      return null;
    }
    return report;
  }

  const scope = await ensureScopedHospital(req, res);
  if (!scope.allowed) return null;
  if (!isSuperAdmin(req.user) && report.patient?.hospitalId !== scope.hospitalId) {
    res.status(403).json({ message: 'Access denied for this hospital report' });
    return null;
  }
  return report;
}

exports.getPatientReports = async (req, res) => {
  try {
    const access = await canAccessPatient(req, res, req.params.patientId);
    if (!access) return;

    const { type } = req.query;
    const where = { patientId: req.params.patientId, isActive: true };
    if (type) where.type = type;

      const pagination = getPaginationParams(req.query, { defaultPerPage: 20, forcePaginate: req.query.paginate !== 'false' });
      const baseOptions = {
        where,
        include: [{ model: Appointment, as: 'appointment', attributes: ['id', 'appointmentNumber', 'appointmentDate'] }],
        order: [['createdAt', 'DESC']],
      };
      if (pagination) {
        const queryOptions = applyPaginationOptions(baseOptions, pagination, { forceDistinct: true });
        const reports = await Report.findAndCountAll(queryOptions);
        return res.json({
          data: reports.rows,
          meta: buildPaginationMeta(pagination, reports.count),
        });
      }
      const reports = await Report.findAll(baseOptions);
      res.json(reports);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getOne = async (req, res) => {
  try {
    const scoped = await canAccessReport(req, res, req.params.id);
    if (!scoped) return;

    const report = await Report.findByPk(scoped.id, {
      include: [
        { model: Patient, as: 'patient', attributes: ['id', 'name', 'patientId'] },
        { model: Appointment, as: 'appointment', attributes: ['id', 'appointmentNumber', 'appointmentDate'] },
      ],
    });
    if (!report) return res.status(404).json({ message: 'Report not found' });
    if (!report.isActive) return res.status(404).json({ message: 'Report not found' });
    res.json(report);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.upload = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const access = await canAccessPatient(req, res, req.params.patientId);
    if (!access) return;

    if (req.body.appointmentId) {
      const appointment = await Appointment.findByPk(req.body.appointmentId, {
        attributes: ['id', 'patientId'],
      });
      if (!appointment) return res.status(400).json({ message: 'Appointment not found' });
      if (appointment.patientId !== req.params.patientId) {
        return res.status(400).json({ message: 'Appointment does not belong to this patient' });
      }
    }

    const report = await Report.create({
      title: req.body.title || req.file.originalname,
      type: req.body.type || 'other',
      fileName: req.file.filename,
      originalName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      description: req.body.description,
      uploadedBy: req.user?.name || 'System',
      patientId: req.params.patientId,
      appointmentId: req.body.appointmentId || null,
      labTestId: req.body.labTestId || null,
    });
    res.status(201).json(report);
  } catch (err) { res.status(400).json({ message: err.message }); }
};

exports.download = async (req, res) => {
  try {
    const report = await canAccessReport(req, res, req.params.id);
    if (!report) return;
    if (!report.isActive) return res.status(404).json({ message: 'Report not found' });
    if (!fs.existsSync(report.filePath)) return res.status(404).json({ message: 'File not found on server' });

    res.download(report.filePath, report.originalName);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// Serves the file inline so the browser can render PDFs and images without forcing download
exports.view = async (req, res) => {
  try {
    const report = await canAccessReport(req, res, req.params.id);
    if (!report) return;
    if (!report.isActive) return res.status(404).json({ message: 'Report not found' });
    if (!fs.existsSync(report.filePath)) return res.status(404).json({ message: 'File not found on server' });

    let contentType = report.mimeType || 'application/octet-stream';
    if (report.originalName?.toLowerCase().endsWith('.dcm') || report.fileName?.toLowerCase().endsWith('.dcm')) {
      contentType = 'application/dicom';
    }
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${report.originalName}"`);
    fs.createReadStream(report.filePath).pipe(res);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.delete = async (req, res) => {
  try {
    const report = await canAccessReport(req, res, req.params.id);
    if (!report) return;
    await report.update({ isActive: false });
    res.json({ message: 'Report deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/reports/billing — aggregate multi-tenant hospital billing report
exports.getBillingReport = async (req, res) => {
  try {
    const { Op } = require('sequelize');
    const { MedicineInvoice, MedicineInvoiceItem, Patient, User, Doctor, Appointment } = require('../models');

    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { from, to, paymentStatus, doctorId, search } = req.query;
    const where = {};

    if (!isSuperAdmin(req.user)) {
      where.hospitalId = scope.hospitalId;
    } else if (req.query.hospitalId) {
      where.hospitalId = req.query.hospitalId;
    }

    // Date range filter on invoiceDate (authoritative bill date)
    if (from && to) where.invoiceDate = { [Op.between]: [from, to] };
    else if (from) where.invoiceDate = { [Op.gte]: from };
    else if (to) where.invoiceDate = { [Op.lte]: to };

    // Payment status filter (isPaid boolean)
    if (paymentStatus === 'paid') where.isPaid = true;
    else if (paymentStatus === 'pending' || paymentStatus === 'unpaid') where.isPaid = false;

    // Doctor filter: Broad (Patient Panel) — includes all pharmacy invoices for patients who have appointments with this doctor
    if (doctorId) {
      const doctorAppts = await Appointment.findAll({
        where: { doctorId },
        attributes: ['patientId'],
        raw: true,
      });
      const patientIds = Array.from(new Set(doctorAppts.map((a) => a.patientId).filter(Boolean)));
      if (patientIds.length > 0) {
        where.patientId = { [Op.in]: patientIds };
      } else {
        where.id = null; // No matching patient panel invoices for this doctorId
      }
    }

    if (search) {
      const searchCondition = { invoiceNumber: { [Op.iLike]: `%${search}%` } };
      if (where[Op.or]) {
        where[Op.and] = [{ [Op.or]: where[Op.or] }, searchCondition];
        delete where[Op.or];
      } else {
        where[Op.or] = [searchCondition];
      }
    }

    const baseOptions = {
      where,
      include: [
        { model: Patient, as: 'patient', attributes: ['id', 'name', 'patientId', 'phone'] },
        { model: User, as: 'soldBy', attributes: ['id', 'name', 'email'] },
        {
          model: MedicineInvoiceItem,
          as: 'items',
          attributes: ['id', 'quantity', 'unitPrice', 'lineTotal', 'itemType', 'unit'],
        },
      ],
      order: [['invoiceDate', 'DESC'], ['createdAt', 'DESC']],
    };

    // Calculate aggregated financial totals across all matching records
    const allMatching = await MedicineInvoice.findAll({
      where,
      attributes: ['subtotal', 'discountAmount', 'taxAmount', 'totalAmount', 'grandTotal', 'paidAmount', 'isPaid'],
    });

    let totalBillAmount = 0;
    let totalPaidAmount = 0;
    let totalPendingAmount = 0;

    allMatching.forEach((inv) => {
      const grand = Number(inv.grandTotal || inv.totalAmount || 0);
      const paid = Number(inv.paidAmount || 0);
      totalBillAmount += grand;
      totalPaidAmount += paid;
      if (!inv.isPaid) {
        totalPendingAmount += Math.max(0, grand - paid);
      }
    });

    const summary = {
      totalInvoicesCount: allMatching.length,
      totalBillAmount: Number(totalBillAmount.toFixed(2)),
      totalPaidAmount: Number(totalPaidAmount.toFixed(2)),
      totalPendingAmount: Number(totalPendingAmount.toFixed(2)),
    };

    const pagination = getPaginationParams(req.query, { defaultPerPage: 25, forcePaginate: req.query.paginate !== 'false' });
    if (pagination) {
      const queryOptions = applyPaginationOptions(baseOptions, pagination, { forceDistinct: true });
      const invoices = await MedicineInvoice.findAndCountAll(queryOptions);
      return res.json({
        data: invoices.rows,
        summary,
        meta: buildPaginationMeta(pagination, invoices.count),
      });
    }

    const invoices = await MedicineInvoice.findAll(baseOptions);
    res.json({ data: invoices, summary });
  } catch (err) {
    console.error('getBillingReport error:', err);
    res.status(500).json({ message: err.message });
  }
};

// GET /api/reports/wait-times — wait-time & consultation duration analytics
exports.getWaitTimeAnalytics = async (req, res) => {
  try {
    const { Op } = require('sequelize');
    const { Appointment, Doctor, Department, Patient } = require('../models');
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { from, to, doctorId, departmentId } = req.query;
    const where = {
      status: { [Op.notIn]: ['cancelled', 'no_show'] },
    };

    if (from && to) where.appointmentDate = { [Op.between]: [from, to] };
    else if (from) where.appointmentDate = { [Op.gte]: from };
    else if (to) where.appointmentDate = { [Op.lte]: to };

    if (doctorId) where.doctorId = doctorId;

    const doctorInclude = {
      model: Doctor,
      as: 'doctor',
      attributes: ['id', 'name', 'specialization', 'departmentId', 'hospitalId'],
      include: [{ model: Department, as: 'department', attributes: ['id', 'name'] }],
      ...(isSuperAdmin(req.user) ? {} : { where: { hospitalId: scope.hospitalId } }),
    };

    if (departmentId) {
      doctorInclude.where = {
        ...(doctorInclude.where || {}),
        departmentId,
      };
    }

    const appointments = await Appointment.findAll({
      where,
      attributes: ['id', 'appointmentDate', 'checkedInAt', 'consultationStartedAt', 'completedAt', 'doctorId'],
      include: [doctorInclude],
      order: [['appointmentDate', 'DESC']],
    });

    let totalWaitTimeMinutes = 0;
    let waitTimeCount = 0;
    let totalConsultationDurationMinutes = 0;
    let consultationCount = 0;

    const doctorMap = new Map();
    const dayMap = new Map();

    appointments.forEach((appt) => {
      const checkedIn = appt.checkedInAt ? new Date(appt.checkedInAt) : null;
      const consultationStarted = appt.consultationStartedAt ? new Date(appt.consultationStartedAt) : null;
      const completed = appt.completedAt ? new Date(appt.completedAt) : null;

      let waitTime = null;
      if (checkedIn && consultationStarted && consultationStarted >= checkedIn) {
        waitTime = Math.round((consultationStarted - checkedIn) / (1000 * 60));
        totalWaitTimeMinutes += waitTime;
        waitTimeCount++;
      }

      let consultationDuration = null;
      if (consultationStarted && completed && completed >= consultationStarted) {
        consultationDuration = Math.round((completed - consultationStarted) / (1000 * 60));
        totalConsultationDurationMinutes += consultationDuration;
        consultationCount++;
      }

      const docId = appt.doctor?.id || 'unknown';
      const docName = appt.doctor?.name || 'Unknown Doctor';
      const spec = appt.doctor?.specialization || 'General';

      if (!doctorMap.has(docId)) {
        doctorMap.set(docId, {
          doctorId: docId,
          doctorName: docName,
          specialization: spec,
          totalAppointments: 0,
          totalWaitMinutes: 0,
          waitCount: 0,
          totalConsultationMinutes: 0,
          consultationCount: 0,
        });
      }
      const docRec = doctorMap.get(docId);
      docRec.totalAppointments++;
      if (waitTime !== null) {
        docRec.totalWaitMinutes += waitTime;
        docRec.waitCount++;
      }
      if (consultationDuration !== null) {
        docRec.totalConsultationMinutes += consultationDuration;
        docRec.consultationCount++;
      }

      const dateKey = appt.appointmentDate;
      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, {
          date: dateKey,
          totalAppointments: 0,
          totalWaitMinutes: 0,
          waitCount: 0,
          totalConsultationMinutes: 0,
          consultationCount: 0,
        });
      }
      const dayRec = dayMap.get(dateKey);
      dayRec.totalAppointments++;
      if (waitTime !== null) {
        dayRec.totalWaitMinutes += waitTime;
        dayRec.waitCount++;
      }
      if (consultationDuration !== null) {
        dayRec.totalConsultationMinutes += consultationDuration;
        dayRec.consultationCount++;
      }
    });

    const avgWaitTimeMinutes = waitTimeCount > 0 ? Number((totalWaitTimeMinutes / waitTimeCount).toFixed(1)) : 0;
    const avgConsultationDurationMinutes = consultationCount > 0 ? Number((totalConsultationDurationMinutes / consultationCount).toFixed(1)) : 0;

    const doctorWise = Array.from(doctorMap.values()).map((d) => ({
      doctorId: d.doctorId,
      doctorName: d.doctorName,
      specialization: d.specialization,
      totalAppointments: d.totalAppointments,
      avgWaitTimeMinutes: d.waitCount > 0 ? Number((d.totalWaitMinutes / d.waitCount).toFixed(1)) : 0,
      avgConsultationDurationMinutes: d.consultationCount > 0 ? Number((d.totalConsultationMinutes / d.consultationCount).toFixed(1)) : 0,
    })).sort((a, b) => b.totalAppointments - a.totalAppointments);

    const dayWise = Array.from(dayMap.values()).map((d) => ({
      date: d.date,
      label: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      totalAppointments: d.totalAppointments,
      avgWaitTimeMinutes: d.waitCount > 0 ? Number((d.totalWaitMinutes / d.waitCount).toFixed(1)) : 0,
      avgConsultationDurationMinutes: d.consultationCount > 0 ? Number((d.totalConsultationMinutes / d.consultationCount).toFixed(1)) : 0,
    })).sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({
      summary: {
        totalAppointments: appointments.length,
        trackedWaitTimesCount: waitTimeCount,
        trackedConsultationsCount: consultationCount,
        avgWaitTimeMinutes,
        avgConsultationDurationMinutes,
      },
      doctorWise,
      dayWise,
      range: { from: from || null, to: to || null },
    });
  } catch (err) {
    console.error('getWaitTimeAnalytics error:', err);
    res.status(500).json({ message: err.message });
  }
};
