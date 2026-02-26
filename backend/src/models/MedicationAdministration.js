const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MedicationAdministration = sequelize.define('MedicationAdministration', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  admissionId: { type: DataTypes.UUID, allowNull: true },
  prescriptionId: { type: DataTypes.UUID, allowNull: false },
  nurseId: { type: DataTypes.UUID, allowNull: false },
  adminDate: { type: DataTypes.DATEONLY, allowNull: false },
  adminTime: { type: DataTypes.TIME, allowNull: false },
  status: {
    type: DataTypes.ENUM('given', 'missed', 'refused', 'delayed'),
    defaultValue: 'given',
  },
  notes: { type: DataTypes.TEXT },
});

module.exports = MedicationAdministration;
