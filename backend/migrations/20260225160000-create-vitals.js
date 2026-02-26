'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Vitals', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
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
      appointmentId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'Appointments',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      nurseId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'Nurses',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      temp: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true
      },
      pulse: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      bp_systolic: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      bp_diastolic: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      spO2: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      respRate: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      weight: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true
      },
      recordedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
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

    // Indexes for performance
    await queryInterface.addIndex('Vitals', ['admissionId']);
    await queryInterface.addIndex('Vitals', ['recordedAt']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Vitals');
  }
};
