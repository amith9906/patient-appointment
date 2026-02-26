const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const IPDNote = sequelize.define('IPDNote', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  admissionId: { type: DataTypes.UUID, allowNull: false },
  doctorId: { type: DataTypes.UUID, allowNull: true },
  nurseId: { type: DataTypes.UUID, allowNull: true },
  noteType: {
    type: DataTypes.ENUM('progress', 'nursing', 'orders', 'consultation'),
    defaultValue: 'progress',
  },
  content: { type: DataTypes.TEXT, allowNull: false },
  noteDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
});

module.exports = IPDNote;
