const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DrugInteraction = sequelize.define('DrugInteraction', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    drugA: {
      type: DataTypes.STRING,
      allowNull: false
    },
    drugB: {
      type: DataTypes.STRING,
      allowNull: false
    },
    severity: {
      type: DataTypes.ENUM('Major', 'Moderate', 'Minor'),
      allowNull: false,
      defaultValue: 'Moderate'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    clinicalAction: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'DrugInteractions',
    timestamps: true
  });

  return DrugInteraction;
};
