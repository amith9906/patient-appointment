const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Patient = sequelize.define('Patient', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  patientId: { type: DataTypes.STRING, comment: 'Hospital-assigned patient ID' },
  name: { type: DataTypes.STRING, allowNull: false },
  dateOfBirth: { type: DataTypes.DATEONLY },
  gender: { type: DataTypes.ENUM('male', 'female', 'other') },
  bloodGroup: {
    type: DataTypes.ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'),
  },
  phone: { type: DataTypes.STRING },
  email: { type: DataTypes.STRING, validate: { isEmail: true } },
  address: { type: DataTypes.TEXT },
  city: { type: DataTypes.STRING },
  state: { type: DataTypes.STRING },
  emergencyContactName: { type: DataTypes.STRING },
  emergencyContactPhone: { type: DataTypes.STRING },
  allergies: { type: DataTypes.TEXT },
  medicalHistory: { type: DataTypes.TEXT },
  insuranceProvider: { type: DataTypes.STRING },
  insuranceNumber: { type: DataTypes.STRING },
  referralSource: { type: DataTypes.STRING(120) },
  referralDetail: { type: DataTypes.STRING(200) },
  chronicConditions: { type: DataTypes.JSONB, defaultValue: [] },
  clinicalAlerts: { type: DataTypes.JSONB, defaultValue: [] },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  userId: { type: DataTypes.UUID, allowNull: true, comment: 'Linked user account for patient self-service' },
}, {
  hooks: {
    beforeCreate: async (patient) => {
      if (!patient.patientId) {
        const count = await Patient.count();
        patient.patientId = `PAT-${String(count + 1).padStart(6, '0')}`;
      }
    },
  },
});

module.exports = Patient;
