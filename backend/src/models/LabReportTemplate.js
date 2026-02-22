const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// A reusable template for structured lab results.
// `fields` is a JSONB array of field definitions:
// [{ key, label, unit, normalRange, normalMin, normalMax, type: 'number'|'text'|'select', options: [] }]
const LabReportTemplate = sequelize.define('LabReportTemplate', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  category: { type: DataTypes.STRING, comment: 'e.g. Blood, Urine, Imaging' },
  description: { type: DataTypes.TEXT },
  fields: { type: DataTypes.JSONB, defaultValue: [] },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  hospitalId: { type: DataTypes.UUID, allowNull: true, comment: 'null = available to all hospitals (super_admin templates)' },
});

module.exports = LabReportTemplate;
