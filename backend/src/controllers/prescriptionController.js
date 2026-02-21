const { Prescription, Medication, Appointment, Patient, Doctor } = require('../models');
const {
  LANGUAGE_MAP,
  SUPPORTED_LANGUAGE_CODES,
  translateTextToLanguages,
} = require('../utils/translator');

function normalizeTranslatedInstructions(value) {
  if (!value) return null;
  const src = typeof value === 'string' ? (() => {
    try { return JSON.parse(value); } catch { return null; }
  })() : value;
  if (!src || typeof src !== 'object' || Array.isArray(src)) return null;

  const out = {};
  Object.keys(src).forEach((key) => {
    const code = String(key || '').toLowerCase();
    if (!SUPPORTED_LANGUAGE_CODES.includes(code)) return;
    const txt = String(src[key] || '').trim();
    if (txt) out[code] = txt;
  });
  return Object.keys(out).length ? out : null;
}

exports.getByAppointment = async (req, res) => {
  try {
    const prescriptions = await Prescription.findAll({
      where: { appointmentId: req.params.appointmentId },
      include: [{ model: Medication, as: 'medication' }],
    });
    res.json(prescriptions);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getMyPrescriptions = async (req, res) => {
  try {
    // Patient sees their own prescriptions via their appointments
    const { Patient } = require('../models');
    const patient = await Patient.findOne({ where: { userId: req.user.id } });
    if (!patient) return res.status(404).json({ message: 'Patient profile not found' });

    const prescriptions = await Prescription.findAll({
      include: [
        { model: Medication, as: 'medication' },
        {
          model: Appointment,
          as: 'appointment',
          where: { patientId: patient.id },
          include: [{ model: Doctor, as: 'doctor', attributes: ['id', 'name', 'specialization'] }],
        },
      ],
      order: [['createdAt', 'DESC']],
    });
    res.json(prescriptions);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.create = async (req, res) => {
  try {
    const payload = { ...req.body };
    const original = String(payload.instructionsOriginal || payload.instructions || '').trim();
    payload.instructionsOriginal = original || null;
    payload.instructions = original || null;
    payload.translatedInstructions = normalizeTranslatedInstructions(payload.translatedInstructions);

    const prescription = await Prescription.create(payload);
    // Deduct stock when medication is dispensed
    if (payload.medicationId && payload.quantity) {
      const med = await Medication.findByPk(payload.medicationId);
      if (med && med.stockQuantity !== null) {
        await med.update({ stockQuantity: Math.max(0, med.stockQuantity - Number(payload.quantity)) });
      }
    }
    const full = await Prescription.findByPk(prescription.id, {
      include: [{ model: Medication, as: 'medication' }],
    });
    res.status(201).json(full);
  } catch (err) { res.status(400).json({ message: err.message }); }
};

exports.update = async (req, res) => {
  try {
    const p = await Prescription.findByPk(req.params.id);
    if (!p) return res.status(404).json({ message: 'Prescription not found' });

    const payload = { ...req.body };
    if (Object.prototype.hasOwnProperty.call(payload, 'instructions')
      || Object.prototype.hasOwnProperty.call(payload, 'instructionsOriginal')) {
      const original = String(payload.instructionsOriginal || payload.instructions || '').trim();
      payload.instructionsOriginal = original || null;
      payload.instructions = original || null;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'translatedInstructions')) {
      payload.translatedInstructions = normalizeTranslatedInstructions(payload.translatedInstructions);
    }

    await p.update(payload);
    res.json(p);
  } catch (err) { res.status(400).json({ message: err.message }); }
};

exports.delete = async (req, res) => {
  try {
    const p = await Prescription.findByPk(req.params.id);
    if (!p) return res.status(404).json({ message: 'Prescription not found' });
    // Restore stock when prescription is deleted
    if (p.medicationId && p.quantity) {
      await Medication.increment('stockQuantity', { by: Number(p.quantity), where: { id: p.medicationId } });
    }
    await p.destroy();
    res.json({ message: 'Prescription deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.translate = async (req, res) => {
  try {
    const { text, targetLanguages = [], sourceLanguage = 'auto' } = req.body || {};
    const { translations, failures } = await translateTextToLanguages({
      text,
      targetLanguages,
      sourceLanguage,
    });

    if (Object.keys(translations).length === 0) {
      return res.status(502).json({
        message: 'Translation failed for all selected languages',
        failures,
      });
    }

    res.json({
      sourceText: text,
      translations,
      failures,
      languageNames: LANGUAGE_MAP,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
