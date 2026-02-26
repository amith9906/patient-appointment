const { Vitals, IPDAdmission, Appointment, Nurse } = require('../models');

const resolveNurseId = async (req) => {
  if (req.user?.role !== 'nurse') return null;
  const nurse = await Nurse.findOne({ where: { userId: req.user.id } });
  return nurse ? nurse.id : null;
};

const parseNumericInput = (field, value) => {
  if (value === null || value === undefined || value === '') return null;
  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) {
    const err = new Error(`${field} must be a numeric value`);
    err.isClient = true;
    throw err;
  }
  return numberValue;
};

exports.record = async (req, res) => {
  try {
    const { admissionId, appointmentId, temp, pulse, bp_systolic, bp_diastolic, spO2, respRate, weight, notes, recordedAt } = req.body;

    // Determine who is recording
    const nurseId = await resolveNurseId(req);

    const vitals = await Vitals.create({
      admissionId: admissionId || null,
      appointmentId: appointmentId || null,
      nurseId,
      temp: parseNumericInput('temp', temp),
      pulse: parseNumericInput('pulse', pulse),
      bp_systolic: parseNumericInput('bp_systolic', bp_systolic),
      bp_diastolic: parseNumericInput('bp_diastolic', bp_diastolic),
      spO2: parseNumericInput('spO2', spO2),
      respRate: parseNumericInput('respRate', respRate),
      weight: parseNumericInput('weight', weight),
      notes,
      recordedAt: recordedAt || new Date()
    });

    res.status(201).json({ success: true, data: vitals });
  } catch (err) {
    if (err.isClient) {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: err.message });
  }
};

exports.getByAppointment = async (req, res) => {
  try {
    const { id: appointmentId } = req.params;

    const vitals = await Vitals.findOne({
      where: { appointmentId },
      include: [{ model: Nurse, as: 'nurse', attributes: ['id', 'name'] }],
      order: [['recordedAt', 'DESC']],
    });

    res.json(vitals || null);
  } catch (err) {
    if (err.isClient) {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: err.message });
  }
};

exports.upsert = async (req, res) => {
  try {
    const { id: appointmentId } = req.params;
    const { temp, pulse, bp_systolic, bp_diastolic, spO2, respRate, weight, notes, recordedAt } = req.body;

    const appt = await Appointment.findByPk(appointmentId, { attributes: ['id'] });
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });

    const nurseId = await resolveNurseId(req);
    const payload = {
      appointmentId,
      temp: parseNumericInput('temp', temp),
      pulse: parseNumericInput('pulse', pulse),
      bp_systolic: parseNumericInput('bp_systolic', bp_systolic),
      bp_diastolic: parseNumericInput('bp_diastolic', bp_diastolic),
      spO2: parseNumericInput('spO2', spO2),
      respRate: parseNumericInput('respRate', respRate),
      weight: parseNumericInput('weight', weight),
      notes,
      recordedAt: recordedAt || new Date(),
    };
    if (nurseId) payload.nurseId = nurseId;

    const existing = await Vitals.findOne({ where: { appointmentId } });
    const vitals = existing ? await existing.update(payload) : await Vitals.create(payload);

    const full = await Vitals.findByPk(vitals.id, {
      include: [{ model: Nurse, as: 'nurse', attributes: ['id', 'name'] }],
    });
    res.json(full);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const { admissionId, appointmentId } = req.query;
    const where = {};
    if (admissionId) where.admissionId = admissionId;
    if (appointmentId) where.appointmentId = appointmentId;

    if (!admissionId && !appointmentId) {
        return res.status(400).json({ message: 'admissionId or appointmentId is required' });
    }

    const history = await Vitals.findAll({
      where,
      include: [
        { model: Nurse, as: 'nurse', attributes: ['id', 'name'] }
      ],
      order: [['recordedAt', 'DESC']]
    });

    res.json({ success: true, data: history });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteRecord = async (req, res) => {
    try {
        const { id } = req.params;
        await Vitals.destroy({ where: { id } });
        res.json({ success: true, message: 'Record deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
