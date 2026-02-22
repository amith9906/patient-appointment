module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('TreatmentPlans')) {
      await queryInterface.createTable('TreatmentPlans', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        planNumber: { type: Sequelize.STRING, unique: true },
        patientId: { type: Sequelize.UUID, allowNull: false, references: { model: 'Patients', key: 'id' }, onDelete: 'CASCADE' },
        doctorId: { type: Sequelize.UUID, allowNull: false, references: { model: 'Doctors', key: 'id' }, onDelete: 'CASCADE' },
        hospitalId: { type: Sequelize.UUID, allowNull: false, references: { model: 'Hospitals', key: 'id' }, onDelete: 'CASCADE' },
        name: { type: Sequelize.STRING, allowNull: false },
        description: { type: Sequelize.TEXT },
        totalSessions: { type: Sequelize.INTEGER, defaultValue: 1 },
        completedSessions: { type: Sequelize.INTEGER, defaultValue: 0 },
        totalAmount: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
        paidAmount: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
        status: { type: Sequelize.ENUM('active', 'completed', 'cancelled'), defaultValue: 'active' },
        startDate: { type: Sequelize.DATEONLY },
        expectedEndDate: { type: Sequelize.DATEONLY },
        sessions: { type: Sequelize.JSONB, defaultValue: [] },
        notes: { type: Sequelize.TEXT },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
    }
  },
  async down(queryInterface) {
    await queryInterface.dropTable('TreatmentPlans');
  },
};
