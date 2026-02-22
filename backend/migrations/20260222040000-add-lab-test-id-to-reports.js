'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('Reports');
    if (!cols.labTestId) {
      await queryInterface.addColumn('Reports', 'labTestId', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'LabTests', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Reports', 'labTestId');
  },
};
