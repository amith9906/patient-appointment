const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Vendor = sequelize.define('Vendor', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  hospitalId: { type: DataTypes.UUID, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  contactPerson: { type: DataTypes.STRING },
  phone: { type: DataTypes.STRING(20) },
  email: { type: DataTypes.STRING },
  address: { type: DataTypes.TEXT },
  city: { type: DataTypes.STRING },
  gstin: { type: DataTypes.STRING(20) },
  pan: { type: DataTypes.STRING(20) },
  category: {
    type: DataTypes.ENUM('medicine', 'lab_supply', 'equipment', 'surgical', 'general'),
    defaultValue: 'medicine',
  },
  paymentTerms: { type: DataTypes.STRING, defaultValue: 'Net 30' },
  notes: { type: DataTypes.TEXT },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
});

module.exports = Vendor;
