'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('VaccinationSchedules', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      patientId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Patients',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      vaccineName: {
        type: Sequelize.STRING,
        allowNull: false
      },
      targetAgeDescription: {
        type: Sequelize.STRING,
        allowNull: false
      },
      dueDate: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      givenDate: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('due', 'given', 'missed', 'postponed'),
        defaultValue: 'due'
      },
      administeredByDoctorId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'Doctors',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      batchNumber: {
        type: Sequelize.STRING,
        allowNull: true
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
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

    const desc = await queryInterface.describeTable('VaccinationSchedules').catch(() => ({}));
    if (desc && desc.patientId) {
      await queryInterface.addIndex('VaccinationSchedules', ['patientId'], { name: 'vac_schedules_patient_id' });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('VaccinationSchedules');
  }
};
