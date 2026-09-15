'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('Referrals')) {
      await queryInterface.createTable('Referrals', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
        },
        hospitalId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'Hospitals', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        patientId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'Patients', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        referringDoctorId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'Doctors', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        referringDoctorName: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        referringDoctorClinic: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        referringDoctorPhone: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        receivingDoctorId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'Doctors', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        referralDate: {
          type: Sequelize.DATEONLY,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
        reason: {
          type: Sequelize.TEXT,
        },
        status: {
          type: Sequelize.ENUM('pending', 'scheduled', 'completed', 'declined'),
          defaultValue: 'pending',
        },
        notes: {
          type: Sequelize.TEXT,
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW'),
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW'),
        },
      });

      await queryInterface.addIndex('Referrals', ['hospitalId']);
      await queryInterface.addIndex('Referrals', ['patientId']);
      await queryInterface.addIndex('Referrals', ['receivingDoctorId']);
      await queryInterface.addIndex('Referrals', ['status']);
    }
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    if (tables.includes('Referrals')) {
      await queryInterface.dropTable('Referrals');
    }
  },
};
