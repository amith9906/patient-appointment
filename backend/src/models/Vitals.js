const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Vitals = sequelize.define('Vitals', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  appointmentId: { type: DataTypes.UUID, allowNull: false, unique: true },

  // ── Cardiovascular ───────────────────────────────────────────────────────
  heartRate:  { type: DataTypes.INTEGER, comment: 'bpm' },
  systolic:   { type: DataTypes.INTEGER, comment: 'mmHg — top number of BP' },
  diastolic:  { type: DataTypes.INTEGER, comment: 'mmHg — bottom number of BP' },

  // ── Metabolic ────────────────────────────────────────────────────────────
  bloodSugar: { type: DataTypes.DECIMAL(6, 1), comment: 'mg/dL' },
  bloodSugarType: {
    type: DataTypes.ENUM('fasting', 'random', 'post_prandial'),
    defaultValue: 'random',
    comment: 'Context of blood sugar reading',
  },

  // ── Body Measurements ────────────────────────────────────────────────────
  weight:  { type: DataTypes.DECIMAL(5, 1), comment: 'kg' },
  height:  { type: DataTypes.DECIMAL(5, 1), comment: 'cm' },
  bmi:     { type: DataTypes.DECIMAL(4, 1), comment: 'Auto-calculated from weight/height' },

  // ── Respiratory & Temperature ────────────────────────────────────────────
  temperature:     { type: DataTypes.DECIMAL(4, 1), comment: 'degrees Celsius' },
  spo2:            { type: DataTypes.INTEGER,        comment: 'Oxygen saturation %' },
  respiratoryRate: { type: DataTypes.INTEGER,        comment: 'Breaths per minute' },

  // ── Clinical ─────────────────────────────────────────────────────────────
  symptoms:   { type: DataTypes.TEXT, comment: 'JSON array of symptom strings' },
  vitalNotes: { type: DataTypes.TEXT, comment: 'Nurse / receptionist notes at time of recording' },
  recordedBy: { type: DataTypes.STRING, comment: 'Name of staff who recorded vitals' },
});

module.exports = Vitals;
