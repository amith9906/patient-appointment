const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const IPDPayment = sequelize.define('IPDPayment', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  admissionId: { type: DataTypes.UUID, allowNull: false },
  hospitalId: { type: DataTypes.UUID, allowNull: false },
  amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  paymentMethod: {
    type: DataTypes.ENUM('cash', 'card', 'upi', 'insurance', 'corporate', 'cheque', 'online', 'other'),
    defaultValue: 'cash',
  },
  referenceNumber: { type: DataTypes.STRING },
  paymentDate: { type: DataTypes.DATEONLY },
  notes: { type: DataTypes.TEXT },
  createdByUserId: { type: DataTypes.UUID, allowNull: true },
});

module.exports = IPDPayment;
