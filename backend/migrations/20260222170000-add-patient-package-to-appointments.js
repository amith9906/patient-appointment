'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Appointments', 'patientPackageId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'PatientPackages', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('Appointments', 'patientPackageId');
  },
};
