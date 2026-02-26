const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Medication = sequelize.define('Medication', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  genericName: { type: DataTypes.STRING },
  composition: { type: DataTypes.TEXT, comment: 'e.g. Paracetamol 500mg + Caffeine 65mg' },
  category: {
    type: DataTypes.ENUM(
      'tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops', 'inhaler', 'patch', 'suppository', 'vaccine', 'other'
    ),
    defaultValue: 'tablet',
  },
  dosage: { type: DataTypes.STRING, comment: 'e.g. 500mg, 10ml' },
  manufacturer: { type: DataTypes.STRING },
  description: { type: DataTypes.TEXT },
  sideEffects: { type: DataTypes.TEXT },
  contraindications: { type: DataTypes.TEXT },
  stockQuantity: { type: DataTypes.INTEGER, defaultValue: 0 },
  unitPrice: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  purchasePrice: { type: DataTypes.DECIMAL(10, 2), comment: 'Cost price from supplier' },
  gstRate: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0.00 },
  hsnCode: { type: DataTypes.STRING(10), comment: 'HSN code for GST classification (e.g. 3004)' },
  barcode: { type: DataTypes.STRING(100), comment: 'EAN/UPC barcode for scanning' },
  supplierName: { type: DataTypes.STRING, comment: 'Default supplier / vendor name' },
  location: { type: DataTypes.STRING(120), comment: 'Rack / shelf mapping, e.g. Shelf A, Box 4' },
  reorderLevel: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 10 },
  scheduleCategory: { type: DataTypes.STRING(40), comment: 'Regulatory category e.g. schedule_h, otc' },
  isRestrictedDrug: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, comment: 'If true, prescriber details are mandatory at sale' },
  interactsWith: { type: DataTypes.JSONB, allowNull: false, defaultValue: [], comment: 'List of medication ids/names with known interaction risk' },
  expiryDate: { type: DataTypes.DATEONLY },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  requiresPrescription: { type: DataTypes.BOOLEAN, defaultValue: true },
});

module.exports = Medication;
