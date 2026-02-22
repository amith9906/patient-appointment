const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OTSchedule = sequelize.define('OTSchedule', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  otNumber: { type: DataTypes.STRING, unique: true },
  hospitalId: { type: DataTypes.UUID, allowNull: false },
  patientId: { type: DataTypes.UUID, allowNull: false },
  surgeonId: { type: DataTypes.UUID, allowNull: false },
  procedureName: { type: DataTypes.STRING, allowNull: false },
  scheduledDate: { type: DataTypes.DATEONLY, allowNull: false },
  scheduledTime: { type: DataTypes.STRING, allowNull: false }, // "HH:MM"
  estimatedDuration: { type: DataTypes.INTEGER, defaultValue: 60 }, // minutes
  otRoom: { type: DataTypes.STRING },
  status: {
    type: DataTypes.ENUM('scheduled', 'in_progress', 'completed', 'cancelled', 'postponed'),
    defaultValue: 'scheduled',
  },
  anesthesiaType: {
    type: DataTypes.ENUM('general', 'local', 'spinal', 'epidural', 'none'),
    defaultValue: 'none',
  },
  admissionId: { type: DataTypes.UUID, allowNull: true },
  preOpNotes: { type: DataTypes.TEXT },
  postOpNotes: { type: DataTypes.TEXT },
  outcome: { type: DataTypes.TEXT },
  actualStartTime: { type: DataTypes.DATE, allowNull: true },
  actualEndTime: { type: DataTypes.DATE, allowNull: true },
}, {
  hooks: {
    beforeCreate: async (schedule) => {
      const count = await OTSchedule.count();
      schedule.otNumber = `OT-${String(count + 1).padStart(6, '0')}`;
    },
  },
});

module.exports = OTSchedule;
