const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Referral = sequelize.define('Referral', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  hospitalId: { type: DataTypes.UUID, allowNull: false },
  patientId: { type: DataTypes.UUID, allowNull: false },
  referringDoctorId: { type: DataTypes.UUID, allowNull: true, comment: 'FK to Doctor if internal referring doctor' },
  referringDoctorName: { type: DataTypes.STRING, allowNull: true, comment: 'Free text for external doctor name' },
  referringDoctorClinic: { type: DataTypes.STRING, allowNull: true, comment: 'Free text for external clinic/hospital' },
  referringDoctorPhone: { type: DataTypes.STRING, allowNull: true },
  receivingDoctorId: { type: DataTypes.UUID, allowNull: false, comment: 'FK to internal receiving Doctor' },
  referralDate: { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW },
  reason: { type: DataTypes.TEXT },
  status: {
    type: DataTypes.ENUM('pending', 'scheduled', 'completed', 'declined'),
    defaultValue: 'pending',
  },
  notes: { type: DataTypes.TEXT },
});

module.exports = Referral;
