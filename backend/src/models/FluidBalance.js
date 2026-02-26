const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FluidBalance = sequelize.define('FluidBalance', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  admissionId: { type: DataTypes.UUID, allowNull: false },
  nurseId: { type: DataTypes.UUID, allowNull: false },
  type: {
    type: DataTypes.ENUM('intake', 'output'),
    allowNull: false,
  },
  route: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  amount: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  notes: { type: DataTypes.TEXT },
  recordedAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
});

module.exports = FluidBalance;
