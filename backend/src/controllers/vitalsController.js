const { Vitals, Appointment, Doctor } = require('../models');
const { isSuperAdmin, ensureScopedHospital } = require('../utils/accessScope');

function calcBMI(weight, height) {
  const w = parseFloat(weight);
  const h = parseFloat(height) / 100;
  if (!w || !h) return null;
  return parseFloat((w / (h * h)).toFixed(1));
}

exports.getByAppointment = async (req, res) => {
  try {
    const vitals = await Vitals.findOne({ where: { appointmentId: req.params.id } });
    res.json(vitals || {});
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.upsert = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    // Verify appointment exists and belongs to this hospital
    const appt = await Appointment.findByPk(req.params.id);
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });

    if (!isSuperAdmin(req.user)) {
      const doctor = await Doctor.findByPk(appt.doctorId, { attributes: ['hospitalId'] });
      if (doctor?.hospitalId !== scope.hospitalId) {
        return res.status(403).json({ message: 'Access denied for this appointment' });
      }
    }

    const payload = { ...req.body };

    // Strip empty strings so they don't overwrite numeric nulls
    Object.keys(payload).forEach(k => {
      if (payload[k] === '') payload[k] = null;
    });

    // Auto-calculate BMI when weight and height are both provided
    if (payload.weight && payload.height) {
      payload.bmi = calcBMI(payload.weight, payload.height);
    }

    // Record who saved
    payload.recordedBy = req.user.name || req.user.email || 'Staff';

    const [vitals, created] = await Vitals.findOrCreate({
      where: { appointmentId: req.params.id },
      defaults: { ...payload, appointmentId: req.params.id },
    });

    if (!created) await vitals.update(payload);

    res.json(vitals);
  } catch (err) { res.status(400).json({ message: err.message }); }
};
