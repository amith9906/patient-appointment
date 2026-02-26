const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Nurse = sequelize.define('Nurse', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  phone: { type: DataTypes.STRING },
  email: { type: DataTypes.STRING, unique: true },
  specialization: { type: DataTypes.STRING },
  departmentId: { type: DataTypes.UUID, allowNull: true },
  hospitalId: { type: DataTypes.UUID, allowNull: false },
  userId: { type: DataTypes.UUID, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
});

module.exports = Nurse;
