const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MedicineInvoiceItem = sequelize.define('MedicineInvoiceItem', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  invoiceId: { type: DataTypes.UUID, allowNull: false },
  medicationId: { type: DataTypes.UUID, allowNull: false },
  batchNo: { type: DataTypes.STRING },
  expiryDate: { type: DataTypes.DATEONLY },
  quantity: { type: DataTypes.DECIMAL(8, 2), allowNull: false },
  unitPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  discountPct: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
  taxPct: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
  cgstPct: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
  sgstPct: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
  lineSubtotal: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  lineDiscount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  lineTax: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  cgstAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  sgstAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  lineTotal: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  isRestrictedDrug: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  prescriberDoctorName: { type: DataTypes.STRING(140) },
});

module.exports = MedicineInvoiceItem;
