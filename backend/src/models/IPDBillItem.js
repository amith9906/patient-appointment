const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const IPDBillItem = sequelize.define('IPDBillItem', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  admissionId: { type: DataTypes.UUID, allowNull: false },
  hospitalId: { type: DataTypes.UUID, allowNull: false },
  itemType: {
    type: DataTypes.ENUM(
      'room_charges', 'consultation', 'procedure', 'lab_test', 
      'medication', 'ot_charges', 'nursing', 'equipment', 'other',
      'medicine', 'patient_expense'
    ),
    defaultValue: 'other',
  },
  description: { type: DataTypes.TEXT, allowNull: false },
  quantity: { type: DataTypes.DECIMAL(10, 3), defaultValue: 1 },
  unitPrice: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  amount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },       // quantity * unitPrice
  gstRate: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },       // percentage
  gstAmount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },    // amount * gstRate / 100
  totalWithGst: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 }, // amount + gstAmount
  isPackageCovered: { type: DataTypes.BOOLEAN, defaultValue: false },
  packageId: { type: DataTypes.UUID, allowNull: true },
  date: { type: DataTypes.DATEONLY },
  notes: { type: DataTypes.TEXT },
});

module.exports = IPDBillItem;
