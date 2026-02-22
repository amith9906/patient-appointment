'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

    await queryInterface.createTable('DoctorAvailabilities', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      doctorId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Doctors', key: 'id' },
        onDelete: 'CASCADE',
      },
      dayOfWeek: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      startTime: {
        type: Sequelize.TIME,
        allowNull: false,
      },
      endTime: {
        type: Sequelize.TIME,
        allowNull: false,
      },
      slotDurationMinutes: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 30,
      },
      bufferMinutes: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      maxAppointmentsPerSlot: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      notes: {
        type: Sequelize.TEXT,
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });
    await queryInterface.addIndex('DoctorAvailabilities', ['doctorId']);
    await queryInterface.addIndex('DoctorAvailabilities', ['dayOfWeek']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('DoctorAvailabilities');
  },
};
