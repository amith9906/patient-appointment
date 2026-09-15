'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('Medications');
    if (!tableInfo.catalogId) {
      await queryInterface.addColumn('Medications', 'catalogId', {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'MedicineCatalogs',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }
  },

  async down(queryInterface) {
    const tableInfo = await queryInterface.describeTable('Medications');
    if (tableInfo.catalogId) {
      await queryInterface.removeColumn('Medications', 'catalogId');
    }
  },
};
