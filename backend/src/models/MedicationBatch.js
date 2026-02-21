const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MedicationBatch = sequelize.define('MedicationBatch', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  hospitalId: { type: DataTypes.UUID, allowNull: false },
  medicationId: { type: DataTypes.UUID, allowNull: false },
  batchNo: { type: DataTypes.STRING(60), allowNull: false },
  mfgDate: { type: DataTypes.DATEONLY },
  expiryDate: { type: DataTypes.DATEONLY, allowNull: false },
  purchaseDate: { type: DataTypes.DATEONLY },
  quantityOnHand: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  unitCost: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  notes: { type: DataTypes.TEXT },
});

module.exports = MedicationBatch;

