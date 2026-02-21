const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Expense = sequelize.define('Expense', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  hospitalId: { type: DataTypes.UUID, allowNull: false },
  category: {
    type: DataTypes.ENUM('salary', 'supplies', 'utilities', 'equipment', 'rent', 'maintenance', 'other'),
    defaultValue: 'other',
  },
  description: { type: DataTypes.STRING, allowNull: false },
  amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  notes: { type: DataTypes.TEXT },
});

module.exports = Expense;
