const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const HospitalSettings = sequelize.define('HospitalSettings', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  hospitalId: { type: DataTypes.UUID, allowNull: false, unique: true },

  // Document identity (stamped on PDFs)
  gstin: { type: DataTypes.STRING },
  pan: { type: DataTypes.STRING },
  regNumber: { type: DataTypes.STRING },
  tagline: { type: DataTypes.STRING },

  // Contact overrides (fall back to Hospital table if blank)
  phone: { type: DataTypes.STRING },
  altPhone: { type: DataTypes.STRING },
  website: { type: DataTypes.STRING },

  // Default signatory shown on prescriptions / receipts
  doctorName: { type: DataTypes.STRING },
  doctorQualification: { type: DataTypes.STRING },
  doctorRegNumber: { type: DataTypes.STRING },
  doctorSpecialization: { type: DataTypes.STRING },

  // Receipt / PDF config
  receiptHeader: { type: DataTypes.TEXT },
  receiptFooter: { type: DataTypes.TEXT, defaultValue: 'Thank you for choosing our hospital. Get well soon!' },
  currency: { type: DataTypes.STRING, defaultValue: '₹' },
  dateFormat: { type: DataTypes.STRING, defaultValue: 'DD/MM/YYYY' },
  timezone: { type: DataTypes.STRING, defaultValue: 'Asia/Kolkata' },

  // Display toggles on documents
  showLogoOnReceipt: { type: DataTypes.BOOLEAN, defaultValue: true },
  showGSTINOnReceipt: { type: DataTypes.BOOLEAN, defaultValue: true },
  showDoctorOnReceipt: { type: DataTypes.BOOLEAN, defaultValue: true },

  // System / scheduling config
  appointmentSlotDuration: { type: DataTypes.INTEGER, defaultValue: 30 },
  workingHoursFrom: { type: DataTypes.STRING, defaultValue: '09:00' },
  workingHoursTo: { type: DataTypes.STRING, defaultValue: '18:00' },
});

module.exports = HospitalSettings;
