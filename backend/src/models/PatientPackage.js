const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PatientPackage = sequelize.define('PatientPackage', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  hospitalId: { type: DataTypes.UUID, allowNull: false },
  patientId: { type: DataTypes.UUID, allowNull: false },
  packagePlanId: { type: DataTypes.UUID, allowNull: false },
  startDate: { type: DataTypes.DATEONLY, allowNull: false },
  expiryDate: { type: DataTypes.DATEONLY },
  totalVisits: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  usedVisits: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  status: {
    type: DataTypes.ENUM('active', 'completed', 'expired', 'cancelled'),
    allowNull: false,
    defaultValue: 'active',
  },
  purchaseAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  usageHistory: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  notes: { type: DataTypes.TEXT },
  createdByUserId: { type: DataTypes.UUID, allowNull: false },
});

module.exports = PatientPackage;

