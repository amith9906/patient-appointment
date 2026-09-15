const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const IPDAdvanceDeposit = sequelize.define('IPDAdvanceDeposit', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  admissionId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  hospitalId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  patientId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  paymentMode: {
    type: DataTypes.ENUM('cash', 'card', 'upi', 'netbanking', 'cheque', 'other'),
    defaultValue: 'cash',
  },
  transactionRef: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  createdByUserId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  receiptNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  timestamps: true,
  hooks: {
    beforeCreate: async (deposit) => {
      if (!deposit.receiptNumber) {
        const count = await IPDAdvanceDeposit.count();
        deposit.receiptNumber = `ADV-${String(count + 1).padStart(6, '0')}`;
      }
    },
  },
});

module.exports = IPDAdvanceDeposit;
