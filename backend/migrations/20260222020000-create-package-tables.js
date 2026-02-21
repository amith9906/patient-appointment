'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('PackagePlans', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      hospitalId: { type: Sequelize.UUID, allowNull: false },
      name: { type: Sequelize.STRING(150), allowNull: false },
      serviceType: {
        type: Sequelize.ENUM('consultation', 'follow_up', 'procedure', 'custom'),
        allowNull: false,
        defaultValue: 'consultation',
      },
      totalVisits: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      price: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      validityDays: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 30 },
      discountType: {
        type: Sequelize.ENUM('none', 'fixed', 'percent'),
        allowNull: false,
        defaultValue: 'none',
      },
      discountValue: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      notes: { type: Sequelize.TEXT },
      isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable('PatientPackages', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      hospitalId: { type: Sequelize.UUID, allowNull: false },
      patientId: { type: Sequelize.UUID, allowNull: false },
      packagePlanId: { type: Sequelize.UUID, allowNull: false },
      startDate: { type: Sequelize.DATEONLY, allowNull: false },
      expiryDate: { type: Sequelize.DATEONLY, allowNull: true },
      totalVisits: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      usedVisits: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      status: {
        type: Sequelize.ENUM('active', 'completed', 'expired', 'cancelled'),
        allowNull: false,
        defaultValue: 'active',
      },
      purchaseAmount: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      usageHistory: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      notes: { type: Sequelize.TEXT },
      createdByUserId: { type: Sequelize.UUID, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('PackagePlans', ['hospitalId', 'isActive']);
    await queryInterface.addIndex('PatientPackages', ['hospitalId', 'patientId', 'status']);
    await queryInterface.addIndex('PatientPackages', ['packagePlanId']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('PatientPackages');
    await queryInterface.dropTable('PackagePlans');

    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_PatientPackages_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_PackagePlans_serviceType";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_PackagePlans_discountType";');
  },
};

