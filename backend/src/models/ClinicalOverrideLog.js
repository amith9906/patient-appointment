const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ClinicalOverrideLog = sequelize.define('ClinicalOverrideLog', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    hospitalId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    patientId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    doctorId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    alertType: {
      type: DataTypes.STRING,
      allowNull: false
    },
    alertDetails: {
      type: DataTypes.JSONB,
      allowNull: false
    },
    overrideReason: {
      type: DataTypes.TEXT,
      allowNull: false
    }
  }, {
    tableName: 'ClinicalOverrideLogs',
    timestamps: true
  });

  return ClinicalOverrideLog;
};
