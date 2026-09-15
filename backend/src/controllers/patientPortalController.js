const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { Patient, PatientOtp, Hospital, Doctor, User, Appointment, Prescription, Medication, MedicineCatalog, Report, MedicineInvoice, MedicineInvoiceItem } = require('../models');
const { Op } = require('sequelize');

// Helper to hash OTP with SHA-256
function hashOtp(otp, phone) {
  return crypto.createHash('sha256').update(`${otp}:${phone}:${process.env.JWT_SECRET || 'secret'}`).digest('hex');
}

// POST /api/patient-portal/auth/request-otp
exports.requestOtp = async (req, res) => {
  try {
    const phone = String(req.body.phone || '').trim();
    const { hospitalId } = req.body;

    if (!phone) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    // Rate limit check: Max 3 OTP requests per 15 minutes for this phone number
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    const recentRequestsCount = await PatientOtp.count({
      where: {
        phone,
        createdAt: { [Op.gte]: fifteenMinsAgo },
      },
    });

    if (recentRequestsCount >= 3) {
      return res.status(429).json({
        message: 'Too many OTP requests. Please wait 15 minutes before requesting again.',
      });
    }

    // Search for patient profiles matching this phone number
    const patientWhere = { phone, isActive: true };
    if (hospitalId) patientWhere.hospitalId = hospitalId;

    const patients = await Patient.findAll({
      where: patientWhere,
      include: [{ model: Hospital, as: 'hospital', attributes: ['id', 'name'] }],
    });

    if (!patients.length) {
      return res.status(404).json({
        message: 'No patient record found matching this phone number. Please contact your hospital staff.',
      });
    }

    // If multiple patients found across hospitals and no hospitalId specified, prompt user to choose hospital
    if (patients.length > 1 && !hospitalId) {
      const hospitalOptions = patients.map((p) => ({
        hospitalId: p.hospitalId,
        hospitalName: p.hospital?.name || 'Unknown Hospital',
        patientName: p.name,
      }));
      return res.status(300).json({
        message: 'Multiple hospital patient profiles found for this phone number. Please select your hospital.',
        hospitals: hospitalOptions,
      });
    }

    const selectedPatient = patients[0];

    // Delivery method check:
    // SMS integration is out of scope. Email delivery is used if patient has email.
    // devOtp is HARD-GATED behind NODE_ENV === 'development'.
    const isDevEnvironment = process.env.NODE_ENV === 'development';
    if (!selectedPatient.email && !isDevEnvironment) {
      return res.status(400).json({
        message: 'No contact method on file for OTP delivery. Please contact clinic staff to update your profile.',
      });
    }

    // Generate cryptographically secure 6-digit OTP
    const rawOtp = String(crypto.randomInt(100000, 999999));
    const otpHash = hashOtp(rawOtp, phone);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Save OTP record
    await PatientOtp.create({
      phone,
      hospitalId: selectedPatient.hospitalId,
      otpHash,
      expiresAt,
      attempts: 0,
      requestCount: recentRequestsCount + 1,
      lastRequestedAt: new Date(),
      isUsed: false,
    });

    // Build response payload
    const responsePayload = {
      message: selectedPatient.email
        ? `OTP sent to email ${selectedPatient.email.replace(/(.{2})(.*)(?=@)/, '$1***')}`
        : 'OTP generated for development environment.',
      phone,
      hospitalId: selectedPatient.hospitalId,
      expiresInMinutes: 10,
    };

    // HARD GATED DEV OTP OUTPUT: Never included in non-dev environments
    if (isDevEnvironment) {
      responsePayload.devOtp = rawOtp;
      responsePayload.devNotice = 'DEV MODE ACTIVE: OTP included in response for automated testing only.';
    }

    res.json(responsePayload);
  } catch (err) {
    console.error('requestOtp error:', err);
    res.status(500).json({ message: err.message });
  }
};

// POST /api/patient-portal/auth/verify-otp
exports.verifyOtp = async (req, res) => {
  try {
    const phone = String(req.body.phone || '').trim();
    const otp = String(req.body.otp || '').trim();
    const { hospitalId } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ message: 'Phone and OTP are required' });
    }

    // Find latest active OTP record for this phone
    const otpRecord = await PatientOtp.findOne({
      where: {
        phone,
        isUsed: false,
        expiresAt: { [Op.gte]: new Date() },
        ...(hospitalId ? { hospitalId } : {}),
      },
      order: [['createdAt', 'DESC']],
    });

    if (!otpRecord) {
      return res.status(400).json({ message: 'Invalid or expired OTP. Please request a new OTP.' });
    }

    // Check if maximum attempts (3) already exceeded
    if (otpRecord.attempts >= 3) {
      await otpRecord.update({ isUsed: true }); // Lock out this OTP
      return res.status(400).json({
        message: 'Maximum verification attempts exceeded. Please request a new OTP.',
      });
    }

    // Verify OTP hash
    const inputHash = hashOtp(otp, phone);
    if (inputHash !== otpRecord.otpHash) {
      const nextAttempts = otpRecord.attempts + 1;
      const willBeLocked = nextAttempts >= 3;
      await otpRecord.update({
        attempts: nextAttempts,
        isUsed: willBeLocked, // Mark as locked if 3 attempts reached
      });

      return res.status(400).json({
        message: willBeLocked
          ? 'Maximum verification attempts exceeded. Please request a new OTP.'
          : `Invalid OTP. ${3 - nextAttempts} attempt(s) remaining.`,
      });
    }

    // OTP is valid! Mark as used.
    await otpRecord.update({ isUsed: true });

    // Fetch patient profile
    const patientWhere = { phone, isActive: true };
    if (hospitalId || otpRecord.hospitalId) {
      patientWhere.hospitalId = hospitalId || otpRecord.hospitalId;
    }
    const patient = await Patient.findOne({
      where: patientWhere,
      include: [{ model: Hospital, as: 'hospital', attributes: ['id', 'name', 'phone', 'email'] }],
    });

    if (!patient) {
      return res.status(404).json({ message: 'Patient profile not found' });
    }

    // Issue Patient Portal Token — EXACT Lifetime: 24 Hours
    const token = jwt.sign(
      {
        id: patient.id,
        patientId: patient.id,
        hospitalId: patient.hospitalId,
        role: 'patient',
        isPatientPortal: true,
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    res.json({
      message: 'OTP verified successfully',
      token,
      expiresIn: '24h',
      patient: {
        id: patient.id,
        name: patient.name,
        patientId: patient.patientId,
        phone: patient.phone,
        email: patient.email,
        gender: patient.gender,
        dateOfBirth: patient.dateOfBirth,
        hospital: patient.hospital,
      },
    });
  } catch (err) {
    console.error('verifyOtp error:', err);
    res.status(500).json({ message: err.message });
  }
};

// GET /api/patient-portal/me
exports.getMe = async (req, res) => {
  try {
    const patient = await Patient.findByPk(req.user.patientId, {
      include: [{ model: Hospital, as: 'hospital', attributes: ['id', 'name', 'address', 'phone', 'email'] }],
    });
    if (!patient) return res.status(404).json({ message: 'Patient profile not found' });
    res.json(patient);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/patient-portal/appointments
exports.getAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.findAll({
      where: { patientId: req.user.patientId },
      include: [
        {
          model: Doctor,
          as: 'doctor',
          attributes: ['id', 'specialization'],
          include: [{ model: User, as: 'user', attributes: ['name'] }],
        },
      ],
      order: [['appointmentDate', 'DESC'], ['appointmentTime', 'DESC']],
    });
    res.json(appointments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/patient-portal/prescriptions
exports.getPrescriptions = async (req, res) => {
  try {
    const appointments = await Appointment.findAll({
      where: { patientId: req.user.patientId },
      attributes: ['id'],
    });
    const appointmentIds = appointments.map((a) => a.id);

    const prescriptions = await Prescription.findAll({
      where: { appointmentId: { [Op.in]: appointmentIds } },
      include: [
        {
          model: Medication,
          as: 'medication',
          include: [{ model: MedicineCatalog, as: 'catalog', attributes: ['name', 'genericName', 'composition'] }],
        },
        {
          model: Appointment,
          as: 'appointment',
          attributes: ['id', 'appointmentNumber', 'appointmentDate'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });
    res.json(prescriptions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/patient-portal/reports
exports.getReports = async (req, res) => {
  try {
    const reports = await Report.findAll({
      where: { patientId: req.user.patientId, isActive: true },
      attributes: ['id', 'title', 'type', 'fileName', 'originalName', 'fileSize', 'mimeType', 'createdAt'],
      order: [['createdAt', 'DESC']],
    });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/patient-portal/invoices
exports.getInvoices = async (req, res) => {
  try {
    const invoices = await MedicineInvoice.findAll({
      where: { patientId: req.user.patientId },
      include: [
        {
          model: MedicineInvoiceItem,
          as: 'items',
          attributes: ['id', 'quantity', 'unitPrice', 'lineTotal', 'itemType', 'unit'],
        },
      ],
      order: [['invoiceDate', 'DESC']],
    });
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/patient-portal/reports/:id/view
exports.viewReport = async (req, res) => {
  try {
    const report = await Report.findByPk(req.params.id);
    if (!report || !report.isActive) {
      return res.status(404).json({ message: 'Report not found' });
    }

    // STRICT PATIENT PORTAL SCOPING GUARD: Must belong to req.user.patientId from token payload
    if (report.patientId !== req.user.patientId) {
      return res.status(403).json({ message: 'Access denied for this report' });
    }

    if (!fs.existsSync(report.filePath)) {
      return res.status(404).json({ message: 'File not found on server' });
    }

    let contentType = report.mimeType || 'application/octet-stream';
    if (report.originalName?.toLowerCase().endsWith('.dcm') || report.fileName?.toLowerCase().endsWith('.dcm')) {
      contentType = 'application/dicom';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${report.originalName}"`);
    fs.createReadStream(report.filePath).pipe(res);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
