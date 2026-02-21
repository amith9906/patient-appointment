const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const crypto = require('crypto');

const MedicineInvoice = sequelize.define('MedicineInvoice', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  invoiceNumber: { type: DataTypes.STRING, unique: true },
  invoiceDate: { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW },
  hospitalId: { type: DataTypes.UUID, allowNull: false },
  patientId: { type: DataTypes.UUID, allowNull: true },
  soldByUserId: { type: DataTypes.UUID, allowNull: true },
  subtotal: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  discountAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  taxAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  totalAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  paymentMode: {
    type: DataTypes.ENUM('cash', 'upi', 'card', 'net_banking', 'insurance', 'other'),
    defaultValue: 'cash',
  },
  isPaid: { type: DataTypes.BOOLEAN, defaultValue: true },
  notes: { type: DataTypes.TEXT },
}, {
  hooks: {
    beforeCreate: async (invoice) => {
      if (invoice.invoiceNumber) return;

      let generated = null;
      for (let i = 0; i < 5; i += 1) {
        const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
        const candidate = `MED-${suffix}`;
        const existing = await MedicineInvoice.findOne({ where: { invoiceNumber: candidate }, attributes: ['id'] });
        if (!existing) {
          generated = candidate;
          break;
        }
      }

      invoice.invoiceNumber = generated || `MED-${Date.now()}`;
    },
  },
});

module.exports = MedicineInvoice;
