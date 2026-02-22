'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    if (tables.includes('OTSchedules')) return;

    await queryInterface.createTable('OTSchedules', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      otNumber: { type: Sequelize.STRING, unique: true },
      hospitalId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'Hospitals', key: 'id' }, onDelete: 'CASCADE',
      },
      patientId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'Patients', key: 'id' }, onDelete: 'CASCADE',
      },
      surgeonId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'Doctors', key: 'id' }, onDelete: 'CASCADE',
      },
      procedureName: { type: Sequelize.STRING, allowNull: false },
      scheduledDate: { type: Sequelize.DATEONLY, allowNull: false },
      scheduledTime: { type: Sequelize.STRING, allowNull: false },
      estimatedDuration: { type: Sequelize.INTEGER, defaultValue: 60 },
      otRoom: { type: Sequelize.STRING },
      status: {
        type: Sequelize.ENUM('scheduled', 'in_progress', 'completed', 'cancelled', 'postponed'),
        defaultValue: 'scheduled',
      },
      anesthesiaType: {
        type: Sequelize.ENUM('general', 'local', 'spinal', 'epidural', 'none'),
        defaultValue: 'none',
      },
      admissionId: {
        type: Sequelize.UUID, allowNull: true,
        references: { model: 'IPDAdmissions', key: 'id' }, onDelete: 'SET NULL',
      },
      preOpNotes: { type: Sequelize.TEXT },
      postOpNotes: { type: Sequelize.TEXT },
      outcome: { type: Sequelize.TEXT },
      actualStartTime: { type: Sequelize.DATE, allowNull: true },
      actualEndTime: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('OTSchedules').catch(() => {});
  },
};
