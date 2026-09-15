const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DoseRangeRule = sequelize.define('DoseRangeRule', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    drugName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    patientGroup: {
      type: DataTypes.ENUM('Adult', 'Pediatric', 'Geriatric'),
      allowNull: false
    },
    maxDailyDoseMg: {
      type: DataTypes.FLOAT,
      allowNull: false
    }
  }, {
    tableName: 'DoseRangeRules',
    timestamps: true
  });

  return DoseRangeRule;
};
