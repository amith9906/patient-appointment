const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Prescription = sequelize.define('Prescription', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  dosage: { type: DataTypes.STRING, comment: 'Prescribed dosage' },
  route: { type: DataTypes.STRING, comment: 'e.g. oral, topical, IV' },
  frequency: { type: DataTypes.STRING, comment: 'e.g. twice a day, every 8 hours' },
  timing: { type: DataTypes.STRING, comment: 'e.g. before food, after food, bedtime' },
  whenToUse: { type: DataTypes.STRING, comment: 'e.g. morning and night, as needed for pain' },
  duration: { type: DataTypes.STRING, comment: 'e.g. 7 days, 2 weeks' },
  instructions: { type: DataTypes.TEXT },
  instructionsOriginal: { type: DataTypes.TEXT, comment: 'Doctor-entered original note language' },
  translatedInstructions: { type: DataTypes.JSONB, allowNull: true, comment: 'Map of languageCode => translated note' },
  quantity: { type: DataTypes.INTEGER, defaultValue: 1 },
  admissionId: { type: DataTypes.UUID, allowNull: true },
});

module.exports = Prescription;
