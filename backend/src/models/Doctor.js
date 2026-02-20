const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Doctor = sequelize.define('Doctor', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  specialization: { type: DataTypes.STRING, allowNull: false },
  qualification: { type: DataTypes.STRING },
  licenseNumber: { type: DataTypes.STRING, unique: true },
  phone: { type: DataTypes.STRING },
  email: { type: DataTypes.STRING, validate: { isEmail: true } },
  experience: { type: DataTypes.INTEGER, defaultValue: 0, comment: 'Years of experience' },
  consultationFee: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  availableDays: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  },
  availableFrom: { type: DataTypes.TIME, defaultValue: '09:00' },
  availableTo: { type: DataTypes.TIME, defaultValue: '17:00' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  bio: { type: DataTypes.TEXT },
  gender: { type: DataTypes.ENUM('male', 'female', 'other') },
});

module.exports = Doctor;
