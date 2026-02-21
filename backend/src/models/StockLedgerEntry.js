const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const StockLedgerEntry = sequelize.define('StockLedgerEntry', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  hospitalId: { type: DataTypes.UUID, allowNull: false },
  medicationId: { type: DataTypes.UUID, allowNull: false },
  batchId: { type: DataTypes.UUID },
  entryDate: { type: DataTypes.DATEONLY, allowNull: false },
  entryType: {
    type: DataTypes.ENUM(
      'opening',
      'purchase',
      'sale',
      'manual_add',
      'manual_subtract',
      'purchase_return',
      'sales_return'
    ),
    allowNull: false,
  },
  quantityIn: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  quantityOut: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  balanceAfter: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  referenceType: { type: DataTypes.STRING(40) },
  referenceId: { type: DataTypes.UUID },
  notes: { type: DataTypes.TEXT },
  createdByUserId: { type: DataTypes.UUID, allowNull: false },
});

module.exports = StockLedgerEntry;

