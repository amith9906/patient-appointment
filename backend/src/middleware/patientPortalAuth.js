const jwt = require('jsonwebtoken');
const { Patient } = require('../models');

const authenticatePatientPortal = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');

    // EXPLICIT STRUCTURAL GUARD: Token MUST have isPatientPortal === true and role === 'patient'
    if (!decoded.isPatientPortal || decoded.role !== 'patient' || !decoded.patientId) {
      return res.status(401).json({ message: 'Unauthorized: Invalid patient portal token' });
    }

    const patient = await Patient.findByPk(decoded.patientId, {
      attributes: ['id', 'name', 'phone', 'email', 'hospitalId', 'isActive'],
    });

    if (!patient || !patient.isActive) {
      return res.status(401).json({ message: 'Patient account not found or inactive' });
    }

    // Attach patient user scope strictly from verified token + DB lookup
    req.user = {
      id: patient.id,
      patientId: patient.id,
      hospitalId: patient.hospitalId,
      role: 'patient',
      isPatientPortal: true,
      phone: patient.phone,
      name: patient.name,
    };

    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

module.exports = { authenticatePatientPortal };
