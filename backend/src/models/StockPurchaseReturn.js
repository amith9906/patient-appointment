const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const crypto = require('crypto');

const StockPurchaseReturn = sequelize.define('StockPurchaseReturn', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  returnNumber: { type: DataTypes.STRING, unique: true },
  hospitalId: { type: DataTypes.UUID, allowNull: false },
  stockPurchaseId: { type: DataTypes.UUID, allowNull: false },
  medicationId: { type: DataTypes.UUID, allowNull: false },
  vendorId: { type: DataTypes.UUID, allowNull: true },
  createdByUserId: { type: DataTypes.UUID, allowNull: true },
  returnDate: { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW },
  quantity: { type: DataTypes.INTEGER, allowNull: false },
  unitCost: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  taxPct: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
  taxableAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  taxAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  totalAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  reason: { type: DataTypes.STRING(200) },
  notes: { type: DataTypes.TEXT },
}, {
  hooks: {
    beforeCreate: async (ret) => {
      if (ret.returnNumber) return;
      let generated = null;
      for (let i = 0; i < 5; i += 1) {
        const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
        const candidate = `DRN-${suffix}`;
        const existing = await StockPurchaseReturn.findOne({ where: { returnNumber: candidate }, attributes: ['id'] });
        if (!existing) {
          generated = candidate;
          break;
        }
      }
      ret.returnNumber = generated || `DRN-${Date.now()}`;
    },
  },
});

module.exports = StockPurchaseReturn;
