const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const MasterCatalog = sequelize.define('MasterCatalog', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    catalogCode: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    catalogName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    category: {
      type: DataTypes.ENUM('Doctors', 'Departments', 'Drugs', 'Procedures', 'ICD10', 'SNOMED', 'Lab', 'Radiology'),
      allowNull: false
    },
    activeVersion: {
      type: DataTypes.STRING,
      defaultValue: 'v1.0.0'
    }
  }, {
    tableName: 'MasterCatalogs',
    timestamps: true
  });

  return MasterCatalog;
};
