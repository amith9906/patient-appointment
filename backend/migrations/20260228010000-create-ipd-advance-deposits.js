'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('IPDAdvanceDeposits', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
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
      hospitalId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Hospitals',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
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
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      paymentMode: {
        type: Sequelize.ENUM('cash', 'card', 'upi', 'netbanking', 'cheque', 'other'),
        defaultValue: 'cash'
      },
      transactionRef: {
        type: Sequelize.STRING,
        allowNull: true
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      createdByUserId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      receiptNumber: {
        type: Sequelize.STRING,
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

    const desc = await queryInterface.describeTable('IPDAdvanceDeposits').catch(() => ({}));
    if (desc && desc.admissionId) {
      await queryInterface.addIndex('IPDAdvanceDeposits', ['admissionId'], { name: 'ipd_advances_admission_id' });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('IPDAdvanceDeposits');
  }
};
