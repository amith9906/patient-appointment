'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('NurseHandovers', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      admissionId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'IPDAdmissions',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      fromNurseId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Nurses',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      toNurseId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'Nurses',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      situation: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      background: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      assessment: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      recommendation: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      handoverDate: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      handoverTime: {
        type: Sequelize.TIME,
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('pending', 'signed_off'),
        defaultValue: 'pending'
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

    await queryInterface.addIndex('NurseHandovers', ['admissionId']);
    await queryInterface.addIndex('NurseHandovers', ['fromNurseId']);
    await queryInterface.addIndex('NurseHandovers', ['toNurseId']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('NurseHandovers');
  }
};
