const path = require('path');
const fs = require('fs');
const { Report, Patient, Appointment } = require('../models');

exports.getPatientReports = async (req, res) => {
  try {
    const { type } = req.query;
    const where = { patientId: req.params.patientId, isActive: true };
    if (type) where.type = type;

    const reports = await Report.findAll({
      where,
      include: [{ model: Appointment, as: 'appointment', attributes: ['id', 'appointmentNumber', 'appointmentDate'] }],
      order: [['createdAt', 'DESC']],
    });
    res.json(reports);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getOne = async (req, res) => {
  try {
    const report = await Report.findByPk(req.params.id, {
      include: [
        { model: Patient, as: 'patient', attributes: ['id', 'name', 'patientId'] },
        { model: Appointment, as: 'appointment', attributes: ['id', 'appointmentNumber', 'appointmentDate'] },
      ],
    });
    if (!report) return res.status(404).json({ message: 'Report not found' });
    res.json(report);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.upload = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

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
    });
    res.status(201).json(report);
  } catch (err) { res.status(400).json({ message: err.message }); }
};

exports.download = async (req, res) => {
  try {
    const report = await Report.findByPk(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found' });
    if (!fs.existsSync(report.filePath)) return res.status(404).json({ message: 'File not found on server' });

    res.download(report.filePath, report.originalName);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.delete = async (req, res) => {
  try {
    const report = await Report.findByPk(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found' });
    await report.update({ isActive: false });
    res.json({ message: 'Report deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};
