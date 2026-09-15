const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CatalogVersion = sequelize.define('CatalogVersion', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    masterCatalogId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    version: {
      type: DataTypes.STRING,
      allowNull: false
    },
    dataPayload: {
      type: DataTypes.JSONB,
      allowNull: false
    },
    publishedBy: {
      type: DataTypes.INTEGER
    },
    publishedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'CatalogVersions',
    timestamps: true
  });

  return CatalogVersion;
};
