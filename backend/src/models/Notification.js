const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: true },
  hospitalId: { type: DataTypes.UUID, allowNull: true },
  type: { type: DataTypes.STRING(64), allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  message: { type: DataTypes.TEXT },
  link: { type: DataTypes.STRING(512) },
  metadata: { type: DataTypes.JSONB },
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
});

module.exports = Notification;
