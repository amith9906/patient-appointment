const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DoctorAvailability = sequelize.define('DoctorAvailability', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  doctorId: { type: DataTypes.UUID, allowNull: false },
  dayOfWeek: { type: DataTypes.INTEGER, allowNull: false },
  startTime: { type: DataTypes.TIME, allowNull: false },
  endTime: { type: DataTypes.TIME, allowNull: false },
  slotDurationMinutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 30 },
  bufferMinutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  maxAppointmentsPerSlot: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  notes: { type: DataTypes.TEXT },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
  indexes: [
    { fields: ['doctorId'] },
    { fields: ['dayOfWeek'] },
  ],
});

module.exports = DoctorAvailability;
