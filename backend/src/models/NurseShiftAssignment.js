const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const NurseShiftAssignment = sequelize.define('NurseShiftAssignment', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  nurseId: { type: DataTypes.UUID, allowNull: false },
  shiftId: { type: DataTypes.UUID, allowNull: false },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  workArea: {
    type: DataTypes.ENUM('IPD', 'OPD', 'Emergency', 'Other'),
    defaultValue: 'IPD',
  },
  notes: { type: DataTypes.TEXT },
});

module.exports = NurseShiftAssignment;
