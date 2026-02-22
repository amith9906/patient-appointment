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

      const pagination = getPaginationParams(req, { defaultPerPage: 20, forcePaginate: req.query.paginate !== 'false' });
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

    res.setHeader('Content-Type', report.mimeType || 'application/octet-stream');
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
