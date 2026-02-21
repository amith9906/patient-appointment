'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Patients');

    if (!table.referralSource) {
      await queryInterface.addColumn('Patients', 'referralSource', {
        type: Sequelize.STRING(120),
        allowNull: true,
      });
    }

    if (!table.referralDetail) {
      await queryInterface.addColumn('Patients', 'referralDetail', {
        type: Sequelize.STRING(200),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('Patients');
    if (table.referralDetail) await queryInterface.removeColumn('Patients', 'referralDetail');
    if (table.referralSource) await queryInterface.removeColumn('Patients', 'referralSource');
  },
};

