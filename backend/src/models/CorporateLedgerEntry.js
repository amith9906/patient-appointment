const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CorporateLedgerEntry = sequelize.define('CorporateLedgerEntry', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  hospitalId: { type: DataTypes.UUID, allowNull: false },
  corporateAccountId: { type: DataTypes.UUID, allowNull: false },
  appointmentId: { type: DataTypes.UUID },
  entryType: {
    type: DataTypes.ENUM('opening', 'invoice', 'payment', 'adjustment'),
    allowNull: false,
  },
  entryDate: { type: DataTypes.DATEONLY, allowNull: false },
  referenceNumber: { type: DataTypes.STRING(80) },
  debitAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  creditAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  notes: { type: DataTypes.TEXT },
  createdByUserId: { type: DataTypes.UUID, allowNull: false },
});

module.exports = CorporateLedgerEntry;

