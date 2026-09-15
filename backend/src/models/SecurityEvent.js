const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SecurityEvent = sequelize.define('SecurityEvent', {
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
    eventType: {
      type: DataTypes.STRING,
      allowNull: false
    },
    severity: {
      type: DataTypes.ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
      defaultValue: 'MEDIUM'
    },
    ipAddress: {
      type: DataTypes.STRING
    },
    details: {
      type: DataTypes.JSONB
    }
  }, {
    tableName: 'SecurityEvents',
    timestamps: true
  });

  return SecurityEvent;
};
