const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ClinicalNote = sequelize.define('ClinicalNote', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  patientId: { type: DataTypes.UUID, allowNull: false },
  encounterId: { type: DataTypes.UUID, allowNull: true },
  authorId: { type: DataTypes.UUID, allowNull: false },
  authorRole: { type: DataTypes.STRING, allowNull: false },
  type: { type: DataTypes.STRING, allowNull: true },
  content: { type: DataTypes.JSONB, allowNull: true },
  status: { type: DataTypes.ENUM('draft', 'signed', 'amended'), defaultValue: 'draft' },
  signedAt: { type: DataTypes.DATE, allowNull: true },
  parentNoteId: { type: DataTypes.UUID, allowNull: true },
  audit: { type: DataTypes.JSONB, allowNull: true },
  attachments: { type: DataTypes.JSONB, allowNull: true },
}, {
  tableName: 'ClinicalNotes'
});

module.exports = ClinicalNote;
