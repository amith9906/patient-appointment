const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const crypto = require('crypto');

const Appointment = sequelize.define('Appointment', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  appointmentNumber: { type: DataTypes.STRING, unique: true },
  appointmentDate: { type: DataTypes.DATEONLY, allowNull: false },
  appointmentTime: { type: DataTypes.TIME, allowNull: false },
  duration: { type: DataTypes.INTEGER, defaultValue: 30, comment: 'Duration in minutes' },
  status: {
    type: DataTypes.ENUM('scheduled', 'postponed', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'),
    defaultValue: 'scheduled',
  },
  type: {
    type: DataTypes.ENUM('consultation', 'follow_up', 'emergency', 'routine_checkup', 'lab_test'),
    defaultValue: 'consultation',
  },
  reason: { type: DataTypes.TEXT },
  notes: { type: DataTypes.TEXT },
  symptoms: { type: DataTypes.TEXT },
  examinationFindings: { type: DataTypes.TEXT },
  diagnosis: { type: DataTypes.TEXT },
  patientPackageId: { type: DataTypes.UUID, allowNull: true },
  treatmentDone: { type: DataTypes.TEXT },
  treatmentBill: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  treatmentPlan: { type: DataTypes.TEXT },
  advice: { type: DataTypes.TEXT },
  followUpDate: { type: DataTypes.DATEONLY },
  prescription: { type: DataTypes.TEXT },
  fee: { type: DataTypes.DECIMAL(10, 2) },
  isPaid: { type: DataTypes.BOOLEAN, defaultValue: false },
  billingType: {
    type: DataTypes.ENUM('self_pay', 'insurance', 'corporate'),
    defaultValue: 'self_pay',
  },
  corporateAccountId: { type: DataTypes.UUID },
  corporateInvoiceNumber: { type: DataTypes.STRING(80) },
  corporateInvoiceDate: { type: DataTypes.DATEONLY },
  corporateDueDate: { type: DataTypes.DATEONLY },
  corporatePaymentStatus: {
    type: DataTypes.ENUM('unbilled', 'billed', 'partially_paid', 'paid'),
    defaultValue: 'unbilled',
  },
  insuranceProvider: { type: DataTypes.STRING },
  policyNumber: { type: DataTypes.STRING },
  claimNumber: { type: DataTypes.STRING },
  claimStatus: {
    type: DataTypes.ENUM('na', 'submitted', 'in_review', 'approved', 'rejected', 'settled'),
    defaultValue: 'na',
  },
  claimAmount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  approvedAmount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  claimSubmittedAt: { type: DataTypes.DATEONLY },
  claimRejectionReason: { type: DataTypes.TEXT },
  claimSettlementDate: { type: DataTypes.DATEONLY },
  claimDocuments: { type: DataTypes.JSONB, defaultValue: [] },
}, {
  hooks: {
    beforeCreate: async (appt) => {
      if (appt.appointmentNumber) return;

      let generated = null;
      for (let i = 0; i < 5; i += 1) {
        const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
        const candidate = `APT-${suffix}`;
        const existing = await Appointment.findOne({ where: { appointmentNumber: candidate }, attributes: ['id'] });
        if (!existing) {
          generated = candidate;
          break;
        }
      }

      appt.appointmentNumber = generated || `APT-${Date.now()}`;
    },
  },
});

module.exports = Appointment;
