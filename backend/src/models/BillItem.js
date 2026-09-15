const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BillItem = sequelize.define('BillItem', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  appointmentId: { type: DataTypes.UUID, allowNull: false },
  description: { type: DataTypes.STRING, allowNull: false },
  category: {
    type: DataTypes.ENUM('consultation', 'procedure', 'medication', 'lab_test', 'room_charge', 'other'),
    defaultValue: 'other',
  },
  medicationId: { type: DataTypes.UUID, allowNull: true },
  itemType: {
    type: DataTypes.ENUM('tablet', 'capsule', 'syrup', 'injection', 'iv_fluid', 'consumable', 'procedure', 'cream', 'drops', 'inhaler', 'other'),
    defaultValue: 'other',
  },
  unit: { type: DataTypes.STRING(30), defaultValue: 'pcs' },
  quantity:  { type: DataTypes.DECIMAL(8, 2),  defaultValue: 1,    allowNull: false },
  unitPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  amount:    { type: DataTypes.DECIMAL(10, 2), allowNull: false },  // stored = quantity * unitPrice
  sacCode:   { type: DataTypes.STRING(20), defaultValue: '999312' },
  gstRate:   { type: DataTypes.DECIMAL(5, 2), defaultValue: 0.00 },
  cgstAmount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0.00 },
  sgstAmount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0.00 },
  igstAmount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0.00 },
});

module.exports = BillItem;
