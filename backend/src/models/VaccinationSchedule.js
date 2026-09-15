const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const VaccinationSchedule = sequelize.define('VaccinationSchedule', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  patientId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  vaccineName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  targetAgeDescription: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'e.g. At Birth, 6 Weeks, 10 Weeks, 14 Weeks, 6 Months, 9 Months, 12 Months',
  },
  dueDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  givenDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('due', 'given', 'missed', 'postponed'),
    defaultValue: 'due',
  },
  administeredByDoctorId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  batchNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  timestamps: true,
});

module.exports = VaccinationSchedule;
