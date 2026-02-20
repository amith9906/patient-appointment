const { Prescription, Medication, Appointment, Patient, Doctor } = require('../models');

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
    const prescription = await Prescription.create(req.body);
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
    await p.update(req.body);
    res.json(p);
  } catch (err) { res.status(400).json({ message: err.message }); }
};

exports.delete = async (req, res) => {
  try {
    const p = await Prescription.findByPk(req.params.id);
    if (!p) return res.status(404).json({ message: 'Prescription not found' });
    await p.destroy();
    res.json({ message: 'Prescription deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};
