'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('Medications');
    if (!cols.gstRate) {
      await queryInterface.addColumn('Medications', 'gstRate', {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0.00,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Medications', 'gstRate');
  },
};
