const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DrugSafetyProfile = sequelize.define('DrugSafetyProfile', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    drugName: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    pregnancyCategory: {
      type: DataTypes.ENUM('Safe', 'Use with caution', 'Contraindicated'),
      allowNull: false,
      defaultValue: 'Safe'
    },
    egfrThreshold: {
      type: DataTypes.FLOAT
    },
    renalAdjustmentAdvice: {
      type: DataTypes.TEXT
    },
    hepaticWarning: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'DrugSafetyProfiles',
    timestamps: true
  });

  return DrugSafetyProfile;
};
