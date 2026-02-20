const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Hospital = sequelize.define('Hospital', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  address: { type: DataTypes.TEXT },
  city: { type: DataTypes.STRING },
  state: { type: DataTypes.STRING },
  zipCode: { type: DataTypes.STRING },
  phone: { type: DataTypes.STRING },
  email: { type: DataTypes.STRING, validate: { isEmail: true } },
  website: { type: DataTypes.STRING },
  type: {
    type: DataTypes.ENUM('general', 'specialty', 'clinic', 'teaching', 'emergency'),
    defaultValue: 'general',
  },
  beds: { type: DataTypes.INTEGER, defaultValue: 0 },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  description: { type: DataTypes.TEXT },
});

module.exports = Hospital;
