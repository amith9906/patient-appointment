const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const StockPurchase = sequelize.define('StockPurchase', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  hospitalId: { type: DataTypes.UUID, allowNull: false },
  medicationId: { type: DataTypes.UUID, allowNull: false },
  vendorId: { type: DataTypes.UUID },
  createdByUserId: { type: DataTypes.UUID },
  invoiceNumber: { type: DataTypes.STRING(40) },
  purchaseDate: { type: DataTypes.DATEONLY, allowNull: false },
  quantity: { type: DataTypes.INTEGER, allowNull: false },
  unitCost: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  discountPct: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
  taxPct: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
  taxableAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  taxAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  totalAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  notes: { type: DataTypes.TEXT },
});

module.exports = StockPurchase;
