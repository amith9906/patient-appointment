const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const IPDAdmission = sequelize.define('IPDAdmission', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  admissionNumber: { type: DataTypes.STRING, unique: true },
  patientId: { type: DataTypes.UUID, allowNull: false },
  doctorId: { type: DataTypes.UUID, allowNull: false },
  hospitalId: { type: DataTypes.UUID, allowNull: false },
  roomId: { type: DataTypes.UUID, allowNull: true },
  admissionDate: { type: DataTypes.DATEONLY, allowNull: false },
  dischargeDate: { type: DataTypes.DATEONLY, allowNull: true },
  admissionDiagnosis: { type: DataTypes.TEXT },
  finalDiagnosis: { type: DataTypes.TEXT },
  admissionType: {
    type: DataTypes.ENUM('emergency', 'planned', 'transfer'),
    defaultValue: 'planned',
  },
  status: {
    type: DataTypes.ENUM('admitted', 'discharged', 'transferred'),
    defaultValue: 'admitted',
  },
  totalAmount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  paidAmount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  isPaid: { type: DataTypes.BOOLEAN, defaultValue: false },
  notes: { type: DataTypes.TEXT },
  dischargeNotes: { type: DataTypes.TEXT },
  conditionAtDischarge: {
    type: DataTypes.ENUM('stable', 'improved', 'lama', 'expired', 'transferred'),
    allowNull: true,
  },
}, {
  hooks: {
    beforeCreate: async (admission) => {
      const count = await IPDAdmission.count();
      admission.admissionNumber = `IPD-${String(count + 1).padStart(6, '0')}`;
    },
  },
});

module.exports = IPDAdmission;
