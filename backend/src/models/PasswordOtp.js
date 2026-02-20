const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PasswordOtp = sequelize.define('PasswordOtp', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false },
  otpHash: { type: DataTypes.STRING, allowNull: false },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
  isUsed: { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
  indexes: [
    { fields: ['userId'] },
    { fields: ['email'] },
    { fields: ['expiresAt'] },
  ],
});

module.exports = PasswordOtp;