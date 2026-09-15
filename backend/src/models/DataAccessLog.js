const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const isPostgres = sequelize.getDialect() === 'postgres';
  const DataAccessLog = sequelize.define('DataAccessLog', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    hospitalId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    patientId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    accessedFields: {
      type: isPostgres ? DataTypes.ARRAY(DataTypes.STRING) : DataTypes.JSON,
      allowNull: false,
      defaultValue: []
    },
    purpose: {
      type: DataTypes.STRING,
      defaultValue: 'CLINICAL_TREATMENT'
    }
  }, {
    tableName: 'DataAccessLogs',
    timestamps: true
  });

  return DataAccessLog;
};
