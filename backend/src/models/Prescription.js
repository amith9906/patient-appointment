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
  quantity: { type: DataTypes.INTEGER, defaultValue: 1 },
});

module.exports = Prescription;
