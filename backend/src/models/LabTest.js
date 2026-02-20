const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LabTest = sequelize.define('LabTest', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  testNumber: { type: DataTypes.STRING, unique: true },
  testName: { type: DataTypes.STRING, allowNull: false },
  testCode: { type: DataTypes.STRING },
  category: { type: DataTypes.STRING, comment: 'e.g. Blood, Urine, Imaging, Pathology' },
  description: { type: DataTypes.TEXT },
  price: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  normalRange: { type: DataTypes.STRING },
  unit: { type: DataTypes.STRING },
  turnaroundTime: { type: DataTypes.STRING, comment: 'e.g. 2 hours, 1 day' },
  status: {
    type: DataTypes.ENUM('ordered', 'sample_collected', 'processing', 'completed', 'cancelled'),
    defaultValue: 'ordered',
  },
  orderedDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  completedDate: { type: DataTypes.DATE },
  result: { type: DataTypes.TEXT },
  resultValue: { type: DataTypes.STRING },
  isAbnormal: { type: DataTypes.BOOLEAN, defaultValue: false },
  technicianNotes: { type: DataTypes.TEXT },
  isPaid: { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
  hooks: {
    beforeCreate: async (test) => {
      const count = await LabTest.count();
      test.testNumber = `LAB-${String(count + 1).padStart(6, '0')}`;
    },
  },
});

module.exports = LabTest;
