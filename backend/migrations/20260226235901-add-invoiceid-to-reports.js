/* eslint-disable no-unused-vars */
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Reports', 'invoiceId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'MedicineInvoices', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('Reports', ['invoiceId']);
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('Reports', ['invoiceId']);
    await queryInterface.removeColumn('Reports', 'invoiceId');
  },
};
