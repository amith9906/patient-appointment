const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TreatmentPlan = sequelize.define('TreatmentPlan', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  planNumber: { type: DataTypes.STRING, unique: true },
  patientId: { type: DataTypes.UUID, allowNull: false },
  doctorId: { type: DataTypes.UUID, allowNull: false },
  hospitalId: { type: DataTypes.UUID, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  totalSessions: { type: DataTypes.INTEGER, defaultValue: 1 },
  completedSessions: { type: DataTypes.INTEGER, defaultValue: 0 },
  totalAmount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  paidAmount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  status: {
    type: DataTypes.ENUM('active', 'completed', 'cancelled'),
    defaultValue: 'active',
  },
  startDate: { type: DataTypes.DATEONLY },
  expectedEndDate: { type: DataTypes.DATEONLY },
  sessions: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: '[{ sessionNo, name, plannedDate, completedDate, notes, cost, done }]',
  },
  notes: { type: DataTypes.TEXT },
}, {
  hooks: {
    beforeCreate: async (plan) => {
      const count = await TreatmentPlan.count();
      plan.planNumber = `TP-${String(count + 1).padStart(6, '0')}`;
    },
  },
});

module.exports = TreatmentPlan;
