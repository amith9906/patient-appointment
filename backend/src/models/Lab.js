const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Lab = sequelize.define('Lab', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  phone: { type: DataTypes.STRING },
  email: { type: DataTypes.STRING },
  floor: { type: DataTypes.STRING },
  operatingHours: { type: DataTypes.STRING },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
});

module.exports = Lab;
