'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('FluidBalances', {
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
      type: {
        type: Sequelize.ENUM('intake', 'output'),
        allowNull: false
      },
      route: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'e.g. Oral, IV, Urine, Drainage, Vomitus'
      },
      amount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Amount in ml'
      },
      notes: {
        type: Sequelize.TEXT
      },
      recordedAt: {
        type: Sequelize.DATE,
        allowNull: false
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

    await queryInterface.addIndex('FluidBalances', ['admissionId']);
    await queryInterface.addIndex('FluidBalances', ['nurseId']);
    await queryInterface.addIndex('FluidBalances', ['type']);
    await queryInterface.addIndex('FluidBalances', ['recordedAt']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('FluidBalances');
  }
};
