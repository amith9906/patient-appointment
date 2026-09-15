const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AccessViolation = sequelize.define('AccessViolation', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    hospitalId: {
      type: DataTypes.INTEGER
    },
    userId: {
      type: DataTypes.INTEGER
    },
    attemptedPath: {
      type: DataTypes.STRING,
      allowNull: false
    },
    requiredRole: {
      type: DataTypes.STRING
    },
    actualRole: {
      type: DataTypes.STRING
    },
    ipAddress: {
      type: DataTypes.STRING
    }
  }, {
    tableName: 'AccessViolations',
    timestamps: true
  });

  return AccessViolation;
};
