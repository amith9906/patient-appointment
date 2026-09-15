const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const GlobalSearchIndex = sequelize.define('GlobalSearchIndex', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    hospitalId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    entityType: {
      type: DataTypes.STRING,
      allowNull: false
    },
    entityId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    uhid: {
      type: DataTypes.STRING
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    subtitle: {
      type: DataTypes.STRING
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false
    }
  }, {
    tableName: 'global_search_index',
    timestamps: true,
    underscored: true
  });

  return GlobalSearchIndex;
};
