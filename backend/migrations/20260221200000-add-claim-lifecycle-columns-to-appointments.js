'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.addColumn('Appointments', 'claimRejectionReason', {
        type: Sequelize.TEXT,
        allowNull: true,
      }, { transaction: t });

      await queryInterface.addColumn('Appointments', 'claimSettlementDate', {
        type: Sequelize.DATEONLY,
        allowNull: true,
      }, { transaction: t });

      await queryInterface.addColumn('Appointments', 'claimDocuments', {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      }, { transaction: t });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.removeColumn('Appointments', 'claimDocuments', { transaction: t });
      await queryInterface.removeColumn('Appointments', 'claimSettlementDate', { transaction: t });
      await queryInterface.removeColumn('Appointments', 'claimRejectionReason', { transaction: t });
    });
  },
};

