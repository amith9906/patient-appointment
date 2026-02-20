const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Medication = sequelize.define('Medication', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  genericName: { type: DataTypes.STRING },
  composition: { type: DataTypes.TEXT, comment: 'e.g. Paracetamol 500mg + Caffeine 65mg' },
  category: {
    type: DataTypes.ENUM(
      'tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops', 'inhaler', 'patch', 'suppository', 'other'
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
  expiryDate: { type: DataTypes.DATEONLY },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  requiresPrescription: { type: DataTypes.BOOLEAN, defaultValue: true },
});

module.exports = Medication;
