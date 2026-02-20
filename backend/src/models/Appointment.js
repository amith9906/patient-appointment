const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Appointment = sequelize.define('Appointment', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  appointmentNumber: { type: DataTypes.STRING, unique: true },
  appointmentDate: { type: DataTypes.DATEONLY, allowNull: false },
  appointmentTime: { type: DataTypes.TIME, allowNull: false },
  duration: { type: DataTypes.INTEGER, defaultValue: 30, comment: 'Duration in minutes' },
  status: {
    type: DataTypes.ENUM('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'),
    defaultValue: 'scheduled',
  },
  type: {
    type: DataTypes.ENUM('consultation', 'follow_up', 'emergency', 'routine_checkup', 'lab_test'),
    defaultValue: 'consultation',
  },
  reason: { type: DataTypes.TEXT },
  notes: { type: DataTypes.TEXT },
  symptoms: { type: DataTypes.TEXT },
  examinationFindings: { type: DataTypes.TEXT },
  diagnosis: { type: DataTypes.TEXT },
  treatmentDone: { type: DataTypes.TEXT },
  treatmentBill: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  treatmentPlan: { type: DataTypes.TEXT },
  advice: { type: DataTypes.TEXT },
  followUpDate: { type: DataTypes.DATEONLY },
  prescription: { type: DataTypes.TEXT },
  fee: { type: DataTypes.DECIMAL(10, 2) },
  isPaid: { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
  hooks: {
    beforeCreate: async (appt) => {
      const count = await Appointment.count();
      appt.appointmentNumber = `APT-${String(count + 1).padStart(6, '0')}`;
    },
  },
});

module.exports = Appointment;
