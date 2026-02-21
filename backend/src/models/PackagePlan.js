const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PackagePlan = sequelize.define('PackagePlan', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  hospitalId: { type: DataTypes.UUID, allowNull: false },
  name: { type: DataTypes.STRING(150), allowNull: false },
  serviceType: {
    type: DataTypes.ENUM('consultation', 'follow_up', 'procedure', 'custom'),
    allowNull: false,
    defaultValue: 'consultation',
  },
  totalVisits: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  price: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  validityDays: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 30 },
  discountType: {
    type: DataTypes.ENUM('none', 'fixed', 'percent'),
    allowNull: false,
    defaultValue: 'none',
  },
  discountValue: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  notes: { type: DataTypes.TEXT },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
});

module.exports = PackagePlan;

