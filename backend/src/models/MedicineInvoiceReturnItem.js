const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MedicineInvoiceReturnItem = sequelize.define('MedicineInvoiceReturnItem', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  returnId: { type: DataTypes.UUID, allowNull: false },
  invoiceItemId: { type: DataTypes.UUID, allowNull: false },
  medicationId: { type: DataTypes.UUID, allowNull: false },
  quantity: { type: DataTypes.DECIMAL(8, 2), allowNull: false },
  unitPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  taxPct: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
  lineSubtotal: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  lineTax: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  lineTotal: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
});

module.exports = MedicineInvoiceReturnItem;
