const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const crypto = require('crypto');

const MedicineInvoiceReturn = sequelize.define('MedicineInvoiceReturn', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  returnNumber: { type: DataTypes.STRING, unique: true },
  hospitalId: { type: DataTypes.UUID, allowNull: false },
  invoiceId: { type: DataTypes.UUID, allowNull: false },
  createdByUserId: { type: DataTypes.UUID, allowNull: true },
  returnDate: { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW },
  reason: { type: DataTypes.STRING(200) },
  notes: { type: DataTypes.TEXT },
  subtotal: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  taxAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  totalAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
}, {
  hooks: {
    beforeCreate: async (ret) => {
      if (ret.returnNumber) return;
      let generated = null;
      for (let i = 0; i < 5; i += 1) {
        const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
        const candidate = `CRN-${suffix}`;
        const existing = await MedicineInvoiceReturn.findOne({ where: { returnNumber: candidate }, attributes: ['id'] });
        if (!existing) {
          generated = candidate;
          break;
        }
      }
      ret.returnNumber = generated || `CRN-${Date.now()}`;
    },
  },
});

module.exports = MedicineInvoiceReturn;
