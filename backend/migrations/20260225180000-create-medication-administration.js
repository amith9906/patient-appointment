'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add admissionId to Prescriptions
    const prescCols = await queryInterface.describeTable('Prescriptions');
    if (!prescCols.admissionId) {
      await queryInterface.addColumn('Prescriptions', 'admissionId', {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'IPDAdmissions',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      });
    }

    // Create MedicationAdministrations table
    await queryInterface.createTable('MedicationAdministrations', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      admissionId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'IPDAdmissions',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      prescriptionId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Prescriptions',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      nurseId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Nurses',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      adminDate: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      adminTime: {
        type: Sequelize.TIME,
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('given', 'missed', 'refused', 'delayed'),
        defaultValue: 'given'
      },
      notes: {
        type: Sequelize.TEXT
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    await queryInterface.addIndex('MedicationAdministrations', ['admissionId']);
    await queryInterface.addIndex('MedicationAdministrations', ['prescriptionId']);
    await queryInterface.addIndex('MedicationAdministrations', ['nurseId']);
    await queryInterface.addIndex('MedicationAdministrations', ['adminDate']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('MedicationAdministrations');
    await queryInterface.removeColumn('Prescriptions', 'admissionId');
  }
};
