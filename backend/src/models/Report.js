const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Report = sequelize.define('Report', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  title: { type: DataTypes.STRING, allowNull: false },
  type: {
    type: DataTypes.ENUM('lab_report', 'radiology', 'discharge_summary', 'prescription', 'medical_certificate', 'other'),
    defaultValue: 'lab_report',
  },
  fileName: { type: DataTypes.STRING, allowNull: false },
  originalName: { type: DataTypes.STRING },
  filePath: { type: DataTypes.STRING, allowNull: false },
  fileSize: { type: DataTypes.INTEGER },
  mimeType: { type: DataTypes.STRING },
  description: { type: DataTypes.TEXT },
  uploadedBy: { type: DataTypes.STRING },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  labTestId: { type: DataTypes.UUID, allowNull: true },
});

module.exports = Report;
