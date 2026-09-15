const QRCode = require('qrcode');
const { Doctor, Hospital, Patient, Appointment } = require('../models');

// GET /api/public/doctors/:slug
exports.getDoctorBySlug = async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    if (!slug) return res.status(400).json({ message: 'Doctor slug is required' });

    const doctor = await Doctor.findOne({
      where: { slug, isActive: true },
      attributes: [
        'id', 'name', 'slug', 'specialization', 'qualification',
        'experience', 'consultationFee', 'availableDays',
        'availableFrom', 'availableTo', 'bio', 'gender', 'hospitalId',
      ],
      include: [
        {
          model: Hospital,
          as: 'hospital',
          attributes: ['id', 'name', 'address', 'city', 'state', 'phone', 'email', 'website'],
        },
      ],
    });

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor public profile not found' });
    }

    // Build public booking URL & QR Code Data URL
    const clientOrigin = process.env.CLIENT_URL || 'http://localhost:3000';
    const bookingUrl = `${clientOrigin}/book/${doctor.slug}`;
    const qrCodeDataUrl = await QRCode.toDataURL(bookingUrl, { margin: 2, width: 250 });

    res.json({
      doctor,
      bookingUrl,
      qrCodeDataUrl,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/public/doctors/:slug/book
exports.submitPublicBooking = async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    const doctor = await Doctor.findOne({ where: { slug, isActive: true } });
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor public profile not found' });
    }

    const {
      patientName,
      patientPhone,
      patientEmail,
      dateOfBirth,
      gender,
      appointmentDate,
      appointmentTime = '10:00 AM',
      reason,
    } = req.body;

    if (!patientName || !patientPhone || !appointmentDate) {
      return res.status(400).json({ message: 'patientName, patientPhone, and appointmentDate are required' });
    }

    // Find existing patient by phone and hospitalId, or create new patient profile
    let patient = await Patient.findOne({
      where: { phone: String(patientPhone).trim(), hospitalId: doctor.hospitalId },
    });

    if (!patient) {
      patient = await Patient.create({
        name: String(patientName).trim(),
        phone: String(patientPhone).trim(),
        email: patientEmail ? String(patientEmail).trim() : null,
        dateOfBirth: dateOfBirth || null,
        gender: gender || 'other',
        hospitalId: doctor.hospitalId,
      });
    }

    // Generate unique appointmentNumber
    const count = await Appointment.count();
    const appointmentNumber = `APT-${String(count + 1).padStart(5, '0')}`;

    const appointment = await Appointment.create({
      appointmentNumber,
      doctorId: doctor.id,
      patientId: patient.id,
      appointmentDate,
      appointmentTime,
      status: 'pending_confirmation',
      type: 'consultation',
      reason: reason || 'Public online booking request',
      fee: Number(doctor.consultationFee || 0),
    });

    const fullAppointment = await Appointment.findByPk(appointment.id, {
      include: [
        { model: Patient, as: 'patient', attributes: ['id', 'name', 'phone', 'email'] },
        { model: Doctor, as: 'doctor', attributes: ['id', 'name', 'specialization', 'slug', 'hospitalId'], include: [{ model: Hospital, as: 'hospital', attributes: ['id', 'name', 'phone'] }] },
      ],
    });

    res.status(201).json({
      message: 'Public booking request submitted successfully. Staff review pending.',
      appointment: fullAppointment,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
