const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MedicineCatalog = sequelize.define('MedicineCatalog', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  genericName: { type: DataTypes.STRING },
  composition: { type: DataTypes.TEXT },
  manufacturer: { type: DataTypes.STRING },
  defaultItemType: {
    type: DataTypes.ENUM('tablet', 'capsule', 'syrup', 'injection', 'iv_fluid', 'consumable', 'procedure', 'cream', 'drops', 'inhaler', 'other'),
    defaultValue: 'tablet',
  },
  defaultUnit: { type: DataTypes.STRING(30), defaultValue: 'pcs' },
  isRestrictedDrug: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  hsnCode: { type: DataTypes.STRING(10), defaultValue: '3004' },
}, {
  tableName: 'MedicineCatalogs',
  timestamps: true,
});

module.exports = MedicineCatalog;
