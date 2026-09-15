'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('Appointments');
    if (!tableInfo.checkedInAt) {
      await queryInterface.addColumn('Appointments', 'checkedInAt', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
    if (!tableInfo.consultationStartedAt) {
      await queryInterface.addColumn('Appointments', 'consultationStartedAt', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
    if (!tableInfo.completedAt) {
      await queryInterface.addColumn('Appointments', 'completedAt', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const tableInfo = await queryInterface.describeTable('Appointments');
    if (tableInfo.checkedInAt) await queryInterface.removeColumn('Appointments', 'checkedInAt');
    if (tableInfo.consultationStartedAt) await queryInterface.removeColumn('Appointments', 'consultationStartedAt');
    if (tableInfo.completedAt) await queryInterface.removeColumn('Appointments', 'completedAt');
  },
};
