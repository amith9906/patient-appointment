const { ClinicalNote, Patient, Appointment, IPDAdmission, User } = require('../models');
const { ensureScopedHospital, isSuperAdmin } = require('../utils/accessScope');

exports.create = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { patientId, encounterId, type, content, attachments } = req.body;
    if (!patientId) return res.status(400).json({ message: 'patientId is required' });

    const patient = await Patient.findByPk(patientId);
    if (!patient) return res.status(404).json({ message: 'Patient not found' });
    if (!isSuperAdmin(req.user) && patient.hospitalId !== scope.hospitalId) return res.status(403).json({ message: 'Access denied' });

    // Only allow clinical staff (nurse/doctor) and admins to create
    if (!['nurse', 'doctor', 'admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const note = await ClinicalNote.create({
      patientId,
      encounterId: encounterId || null,
      authorId: req.user.id,
      authorRole: req.user.role,
      type: type || null,
      content: content || null,
      attachments: attachments || null,
      status: 'draft',
      audit: [{ action: 'create', by: req.user.id, at: new Date(), data: content || null }]
    });

    // Return the note with included author (user) data so frontend can display author name
    const noteWithAuthor = await ClinicalNote.findByPk(note.id, {
      include: [{ model: User, as: 'author', attributes: ['id', 'name', 'role', 'email'] }]
    });
    res.status(201).json(noteWithAuthor);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAll = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { patientId, encounterId } = req.query;
    const where = {};
    if (patientId) where.patientId = patientId;
    if (encounterId) where.encounterId = encounterId;

    const notes = await ClinicalNote.findAll({ where, order: [['createdAt', 'DESC']], include: [{ model: User, as: 'author', attributes: ['id', 'name', 'role', 'email'] }] });
    res.json(notes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const note = await ClinicalNote.findByPk(req.params.id, { include: [{ model: User, as: 'author', attributes: ['id', 'name', 'role', 'email'] }] });
    if (!note) return res.status(404).json({ message: 'Note not found' });
    res.json(note);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const note = await ClinicalNote.findByPk(req.params.id);
    if (!note) return res.status(404).json({ message: 'Note not found' });
    if (note.status === 'signed') return res.status(400).json({ message: 'Signed notes cannot be edited; create an amendment instead' });

    // Only the author or admins can update drafts
    if (note.authorId !== req.user.id && !['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only the author or admins can edit this note' });
    }

    const { content, attachments, type } = req.body;
    const audit = Array.isArray(note.audit) ? note.audit : (note.audit ? [note.audit] : []);
    audit.push({ action: 'update', by: req.user.id, at: new Date(), previous: note.content });

    await note.update({ content: content || note.content, attachments: attachments || note.attachments, type: type || note.type, audit });
    const updated = await ClinicalNote.findByPk(note.id, { include: [{ model: User, as: 'author', attributes: ['id', 'name', 'role', 'email'] }] });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Amend a signed note: create a child note with parentNoteId and status 'amended'
exports.amend = async (req, res) => {
  try {
    const parent = await ClinicalNote.findByPk(req.params.id);
    if (!parent) return res.status(404).json({ message: 'Parent note not found' });

    // Allow only clinical staff to amend
    if (!['nurse', 'doctor', 'admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { content, attachments } = req.body;
    const amendment = await ClinicalNote.create({
      patientId: parent.patientId,
      encounterId: parent.encounterId,
      authorId: req.user.id,
      authorRole: req.user.role,
      type: parent.type,
      content,
      attachments: attachments || null,
      status: 'amended',
      parentNoteId: parent.id,
      audit: [{ action: 'amend', by: req.user.id, at: new Date(), previousParent: parent.id }]
    });

    const amendmentWithAuthor = await ClinicalNote.findByPk(amendment.id, { include: [{ model: User, as: 'author', attributes: ['id', 'name', 'role', 'email'] }] });
    res.status(201).json(amendmentWithAuthor);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.sign = async (req, res) => {
  try {
    const note = await ClinicalNote.findByPk(req.params.id);
    if (!note) return res.status(404).json({ message: 'Note not found' });
    if (note.status === 'signed') return res.status(400).json({ message: 'Note already signed' });
    // Only doctors/admins may sign notes
    if (!['doctor', 'admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only doctors or admins can sign notes' });
    }

    const audit = Array.isArray(note.audit) ? note.audit : (note.audit ? [note.audit] : []);
    audit.push({ action: 'sign', by: req.user.id, at: new Date() });

    await note.update({ status: 'signed', signedAt: new Date(), audit });
    const signed = await ClinicalNote.findByPk(note.id, { include: [{ model: User, as: 'author', attributes: ['id', 'name', 'role', 'email'] }] });
    res.json(signed);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
