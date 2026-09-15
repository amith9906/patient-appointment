const { sequelize, Prescription, Medication, Appointment, Patient, Doctor } = require('../models');
const {
  LANGUAGE_MAP,
  SUPPORTED_LANGUAGE_CODES,
  translateTextToLanguages,
} = require('../utils/translator');
const { deductMedicationStock, restoreMedicationStock } = require('../utils/stockManager');

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

const { invalidatePrefix } = require('../utils/cache');

exports.create = async (req, res) => {
  const tx = await sequelize.transaction();
  try {
    const payload = { ...req.body };
    const original = String(payload.instructionsOriginal || payload.instructions || '').trim();
    payload.instructionsOriginal = original || null;
    payload.instructions = original || null;
    payload.translatedInstructions = normalizeTranslatedInstructions(payload.translatedInstructions);

    const prescription = await Prescription.create(payload, { transaction: tx });
    let stockResult = null;

    // Deduct stock when medication is dispensed with full validation & StockLedgerEntry
    if (payload.medicationId && payload.quantity) {
      stockResult = await deductMedicationStock({
        medicationId: payload.medicationId,
        quantity: payload.quantity,
        referenceType: 'prescription',
        referenceId: prescription.id,
        notes: `Prescription dispensed: ${prescription.dosage || ''} (${payload.quantity})`.trim(),
        userId: req.user?.id || null,
        transaction: tx,
      });
    }

    await tx.commit();

    invalidatePrefix('medications');
    invalidatePrefix('patient_history');

    const result = prescription.toJSON();
    if (stockResult && stockResult.medication) {
      result.medication = stockResult.medication.toJSON();
    } else if (payload.medicationId) {
      const med = await Medication.findByPk(payload.medicationId);
      result.medication = med ? med.toJSON() : null;
    } else {
      result.medication = null;
    }

    res.status(201).json(result);
  } catch (err) {
    await tx.rollback();
    res.status(400).json({ message: err.message });
  }
};

exports.bulkCreate = async (req, res) => {
  const tx = await sequelize.transaction();
  try {
    const { appointmentId, items = [] } = req.body || {};
    const payloadItems = Array.isArray(req.body) ? req.body : items;

    if (!Array.isArray(payloadItems) || payloadItems.length === 0) {
      await tx.rollback();
      return res.status(400).json({ message: 'No prescription items provided' });
    }

    const createdPrescriptions = [];

    for (const item of payloadItems) {
      const payload = { ...item };
      if (appointmentId && !payload.appointmentId) {
        payload.appointmentId = appointmentId;
      }
      const original = String(payload.instructionsOriginal || payload.instructions || '').trim();
      payload.instructionsOriginal = original || null;
      payload.instructions = original || null;
      payload.translatedInstructions = normalizeTranslatedInstructions(payload.translatedInstructions);

      const prescription = await Prescription.create(payload, { transaction: tx });
      let stockResult = null;

      if (payload.medicationId && payload.quantity) {
        stockResult = await deductMedicationStock({
          medicationId: payload.medicationId,
          quantity: payload.quantity,
          referenceType: 'prescription',
          referenceId: prescription.id,
          notes: `Prescription dispensed: ${prescription.dosage || ''} (${payload.quantity})`.trim(),
          userId: req.user?.id || null,
          transaction: tx,
        });
      }

      const result = prescription.toJSON();
      if (stockResult && stockResult.medication) {
        result.medication = stockResult.medication.toJSON();
      } else if (payload.medicationId) {
        const med = await Medication.findByPk(payload.medicationId, { transaction: tx });
        result.medication = med ? med.toJSON() : null;
      } else {
        result.medication = null;
      }

      createdPrescriptions.push(result);
    }

    await tx.commit();

    invalidatePrefix('medications');
    invalidatePrefix('patient_history');

    res.status(201).json(createdPrescriptions);
  } catch (err) {
    await tx.rollback();
    res.status(400).json({ message: err.message });
  }
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
  const tx = await sequelize.transaction();
  try {
    const p = await Prescription.findByPk(req.params.id, { transaction: tx });
    if (!p) {
      await tx.rollback();
      return res.status(404).json({ message: 'Prescription not found' });
    }

    // Restore stock when prescription is deleted with StockLedgerEntry
    if (p.medicationId && p.quantity) {
      await restoreMedicationStock({
        medicationId: p.medicationId,
        quantity: p.quantity,
        referenceType: 'prescription',
        referenceId: p.id,
        notes: `Prescription deleted/cancelled (${p.quantity})`,
        userId: req.user?.id || null,
        transaction: tx,
      });
    }

    await p.destroy({ transaction: tx });
    await tx.commit();

    res.json({ message: 'Prescription deleted' });
  } catch (err) {
    await tx.rollback();
    res.status(500).json({ message: err.message });
  }
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
