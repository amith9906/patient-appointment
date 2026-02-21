'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.addColumn('Appointments', 'billingType', {
        type: Sequelize.ENUM('self_pay', 'insurance', 'corporate'),
        allowNull: false,
        defaultValue: 'self_pay',
      }, { transaction: t });

      await queryInterface.addColumn('Appointments', 'insuranceProvider', {
        type: Sequelize.STRING,
        allowNull: true,
      }, { transaction: t });

      await queryInterface.addColumn('Appointments', 'policyNumber', {
        type: Sequelize.STRING,
        allowNull: true,
      }, { transaction: t });

      await queryInterface.addColumn('Appointments', 'claimNumber', {
        type: Sequelize.STRING,
        allowNull: true,
      }, { transaction: t });

      await queryInterface.addColumn('Appointments', 'claimStatus', {
        type: Sequelize.ENUM('na', 'submitted', 'in_review', 'approved', 'rejected', 'settled'),
        allowNull: false,
        defaultValue: 'na',
      }, { transaction: t });

      await queryInterface.addColumn('Appointments', 'claimAmount', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      }, { transaction: t });

      await queryInterface.addColumn('Appointments', 'approvedAmount', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      }, { transaction: t });

      await queryInterface.addColumn('Appointments', 'claimSubmittedAt', {
        type: Sequelize.DATEONLY,
        allowNull: true,
      }, { transaction: t });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.removeColumn('Appointments', 'claimSubmittedAt', { transaction: t });
      await queryInterface.removeColumn('Appointments', 'approvedAmount', { transaction: t });
      await queryInterface.removeColumn('Appointments', 'claimAmount', { transaction: t });
      await queryInterface.removeColumn('Appointments', 'claimStatus', { transaction: t });
      await queryInterface.removeColumn('Appointments', 'claimNumber', { transaction: t });
      await queryInterface.removeColumn('Appointments', 'policyNumber', { transaction: t });
      await queryInterface.removeColumn('Appointments', 'insuranceProvider', { transaction: t });
      await queryInterface.removeColumn('Appointments', 'billingType', { transaction: t });
    });
  },
};

