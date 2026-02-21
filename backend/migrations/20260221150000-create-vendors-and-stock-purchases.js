'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const allTables = await queryInterface.showAllTables();
    const tableSet = new Set(allTables.map((t) => (typeof t === 'string' ? t : t.tableName)));

    if (!tableSet.has('Vendors')) {
      await queryInterface.createTable('Vendors', {
        id: { type: Sequelize.UUID, allowNull: false, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
        hospitalId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'Hospitals', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        name: { type: Sequelize.STRING, allowNull: false },
        contactPerson: { type: Sequelize.STRING },
        phone: { type: Sequelize.STRING(20) },
        email: { type: Sequelize.STRING },
        address: { type: Sequelize.TEXT },
        city: { type: Sequelize.STRING },
        gstin: { type: Sequelize.STRING(20) },
        pan: { type: Sequelize.STRING(20) },
        category: {
          type: Sequelize.ENUM('medicine', 'lab_supply', 'equipment', 'surgical', 'general'),
          allowNull: false,
          defaultValue: 'medicine',
        },
        paymentTerms: { type: Sequelize.STRING, defaultValue: 'Net 30' },
        notes: { type: Sequelize.TEXT },
        isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });

      await queryInterface.addIndex('Vendors', ['hospitalId', 'isActive']);
      await queryInterface.addIndex('Vendors', ['hospitalId', 'name']);
    }

    if (!tableSet.has('StockPurchases')) {
      await queryInterface.createTable('StockPurchases', {
        id: { type: Sequelize.UUID, allowNull: false, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
        hospitalId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'Hospitals', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        medicationId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'Medications', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        vendorId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'Vendors', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        createdByUserId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'Users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        invoiceNumber: { type: Sequelize.STRING(40) },
        purchaseDate: { type: Sequelize.DATEONLY, allowNull: false },
        quantity: { type: Sequelize.INTEGER, allowNull: false },
        unitCost: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
        discountPct: { type: Sequelize.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
        taxPct: { type: Sequelize.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
        taxableAmount: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
        taxAmount: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
        totalAmount: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
        notes: { type: Sequelize.TEXT },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });

      await queryInterface.addIndex('StockPurchases', ['hospitalId', 'purchaseDate']);
      await queryInterface.addIndex('StockPurchases', ['hospitalId', 'taxPct']);
      await queryInterface.addIndex('StockPurchases', ['medicationId']);
      await queryInterface.addIndex('StockPurchases', ['vendorId']);
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('StockPurchases');
    await queryInterface.dropTable('Vendors');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Vendors_category";');
  },
};
