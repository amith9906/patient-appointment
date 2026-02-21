const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CorporateAccount = sequelize.define('CorporateAccount', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  hospitalId: { type: DataTypes.UUID, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  accountCode: { type: DataTypes.STRING(40) },
  gstin: { type: DataTypes.STRING(20) },
  contactPerson: { type: DataTypes.STRING(120) },
  phone: { type: DataTypes.STRING(30) },
  email: { type: DataTypes.STRING(120) },
  address: { type: DataTypes.TEXT },
  creditDays: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 30 },
  creditLimit: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  openingBalance: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  notes: { type: DataTypes.TEXT },
});

module.exports = CorporateAccount;

