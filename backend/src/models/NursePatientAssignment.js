const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const NursePatientAssignment = sequelize.define('NursePatientAssignment', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  nurseId: { type: DataTypes.UUID, allowNull: false },
  admissionId: { type: DataTypes.UUID, allowNull: false },
  shiftId: { type: DataTypes.UUID, allowNull: true },
  doctorId: { type: DataTypes.UUID, allowNull: true },
  assignedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  removedAt: { type: DataTypes.DATE, allowNull: true },
});

module.exports = NursePatientAssignment;
