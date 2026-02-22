const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Room = sequelize.define('Room', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  hospitalId: { type: DataTypes.UUID, allowNull: false },
  roomNumber: { type: DataTypes.STRING, allowNull: false },
  roomType: {
    type: DataTypes.ENUM('general', 'semi_private', 'private', 'icu', 'emergency'),
    defaultValue: 'general',
  },
  floor: { type: DataTypes.STRING },
  totalBeds: { type: DataTypes.INTEGER, defaultValue: 1 },
  pricePerDay: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  description: { type: DataTypes.TEXT },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
});

module.exports = Room;
