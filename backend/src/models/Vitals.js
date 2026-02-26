const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Vitals = sequelize.define('Vitals', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  admissionId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  appointmentId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  nurseId: {
    type: DataTypes.UUID,
    allowNull: true, // Optional if recorded by doctor in OPD
  },
  temp: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    comment: 'Temperature in Celsius',
  },
  pulse: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Pulse in BPM',
  },
  bp_systolic: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  bp_diastolic: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  spO2: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Oxygen Saturation in %',
  },
  respRate: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Respiratory Rate',
  },
  weight: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    comment: 'Weight in kg',
  },
  recordedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  timestamps: true,
});

module.exports = Vitals;
