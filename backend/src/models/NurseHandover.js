const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const NurseHandover = sequelize.define('NurseHandover', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  admissionId: { type: DataTypes.UUID, allowNull: false },
  fromNurseId: { type: DataTypes.UUID, allowNull: false },
  toNurseId: { type: DataTypes.UUID, allowNull: true },
  situation: { type: DataTypes.TEXT, allowNull: false },
  background: { type: DataTypes.TEXT, allowNull: false },
  assessment: { type: DataTypes.TEXT, allowNull: false },
  recommendation: { type: DataTypes.TEXT, allowNull: false },
  handoverDate: { type: DataTypes.DATEONLY, allowNull: false },
  handoverTime: { type: DataTypes.TIME, allowNull: false },
  status: {
    type: DataTypes.ENUM('pending', 'signed_off'),
    defaultValue: 'pending',
  },
});

module.exports = NurseHandover;
