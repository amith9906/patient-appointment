const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CatalogSyncJob = sequelize.define('CatalogSyncJob', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    catalogVersionId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    targetHospitalId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('PENDING', 'IN_PROGRESS', 'SUCCESS', 'FAILED'),
      defaultValue: 'PENDING'
    },
    syncedAt: {
      type: DataTypes.DATE
    },
    errorMessage: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'CatalogSyncJobs',
    timestamps: true
  });

  return CatalogSyncJob;
};
