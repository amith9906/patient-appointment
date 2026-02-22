'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();

    if (!tables.includes('DoctorLeaves')) {
      await queryInterface.createTable('DoctorLeaves', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
        },
        doctorId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'Doctors', key: 'id' },
          onDelete: 'CASCADE',
        },
        leaveDate: {
          type: Sequelize.DATEONLY,
          allowNull: false,
        },
        reason: {
          type: Sequelize.STRING,
        },
        isFullDay: {
          type: Sequelize.BOOLEAN,
          defaultValue: true,
        },
        startTime: {
          type: Sequelize.TIME,
          allowNull: true,
        },
        endTime: {
          type: Sequelize.TIME,
          allowNull: true,
        },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('DoctorLeaves');
  },
};
