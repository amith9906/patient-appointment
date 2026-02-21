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
  quantity:  { type: DataTypes.DECIMAL(8, 2),  defaultValue: 1,    allowNull: false },
  unitPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  amount:    { type: DataTypes.DECIMAL(10, 2), allowNull: false },  // stored = quantity * unitPrice
});

module.exports = BillItem;
