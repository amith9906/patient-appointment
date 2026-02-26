const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DoctorLeave = sequelize.define('DoctorLeave', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  hospitalId: { type: DataTypes.UUID, allowNull: false },
  doctorId:   { type: DataTypes.UUID, allowNull: false },
  leaveDate:  { type: DataTypes.DATEONLY, allowNull: false },
  reason:     { type: DataTypes.STRING },
  isFullDay:  { type: DataTypes.BOOLEAN, defaultValue: true },
  startTime:  { type: DataTypes.TIME, allowNull: true },
  endTime:    { type: DataTypes.TIME, allowNull: true },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending',
  },
  approvedByUserId: { type: DataTypes.UUID, allowNull: true },
  approvalDate: { type: DataTypes.DATE, allowNull: true },
});

module.exports = DoctorLeave;
