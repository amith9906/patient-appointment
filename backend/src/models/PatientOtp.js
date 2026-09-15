const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PatientOtp = sequelize.define('PatientOtp', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  hospitalId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  otpHash: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  attempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
  },
  requestCount: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    allowNull: false,
  },
  lastRequestedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  isUsed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },
});

module.exports = PatientOtp;
