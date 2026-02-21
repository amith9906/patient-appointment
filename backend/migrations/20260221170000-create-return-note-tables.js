'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const allTables = await queryInterface.showAllTables();
    const tableSet = new Set(allTables.map((t) => (typeof t === 'string' ? t : t.tableName)));

    if (!tableSet.has('MedicineInvoiceReturns')) {
      await queryInterface.createTable('MedicineInvoiceReturns', {
        id: { type: Sequelize.UUID, allowNull: false, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
        returnNumber: { type: Sequelize.STRING, unique: true },
        hospitalId: {
          type: Sequelize.UUID, allowNull: false,
          references: { model: 'Hospitals', key: 'id' },
          onUpdate: 'CASCADE', onDelete: 'CASCADE',
        },
        invoiceId: {
          type: Sequelize.UUID, allowNull: false,
          references: { model: 'MedicineInvoices', key: 'id' },
          onUpdate: 'CASCADE', onDelete: 'CASCADE',
        },
        createdByUserId: {
          type: Sequelize.UUID, allowNull: true,
          references: { model: 'Users', key: 'id' },
          onUpdate: 'CASCADE', onDelete: 'SET NULL',
        },
        returnDate: { type: Sequelize.DATEONLY, allowNull: false },
        reason: { type: Sequelize.STRING(200) },
        notes: { type: Sequelize.TEXT },
        subtotal: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
        taxAmount: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
        totalAmount: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
      await queryInterface.addIndex('MedicineInvoiceReturns', ['hospitalId', 'returnDate']);
      await queryInterface.addIndex('MedicineInvoiceReturns', ['invoiceId']);
    }

    if (!tableSet.has('MedicineInvoiceReturnItems')) {
      await queryInterface.createTable('MedicineInvoiceReturnItems', {
        id: { type: Sequelize.UUID, allowNull: false, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
        returnId: {
          type: Sequelize.UUID, allowNull: false,
          references: { model: 'MedicineInvoiceReturns', key: 'id' },
          onUpdate: 'CASCADE', onDelete: 'CASCADE',
        },
        invoiceItemId: {
          type: Sequelize.UUID, allowNull: false,
          references: { model: 'MedicineInvoiceItems', key: 'id' },
          onUpdate: 'CASCADE', onDelete: 'RESTRICT',
        },
        medicationId: {
          type: Sequelize.UUID, allowNull: false,
          references: { model: 'Medications', key: 'id' },
          onUpdate: 'CASCADE', onDelete: 'RESTRICT',
        },
        quantity: { type: Sequelize.DECIMAL(8, 2), allowNull: false },
        unitPrice: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
        taxPct: { type: Sequelize.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
        lineSubtotal: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
        lineTax: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
        lineTotal: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
      await queryInterface.addIndex('MedicineInvoiceReturnItems', ['returnId']);
      await queryInterface.addIndex('MedicineInvoiceReturnItems', ['invoiceItemId']);
      await queryInterface.addIndex('MedicineInvoiceReturnItems', ['medicationId']);
    }

    if (!tableSet.has('StockPurchaseReturns')) {
      await queryInterface.createTable('StockPurchaseReturns', {
        id: { type: Sequelize.UUID, allowNull: false, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
        returnNumber: { type: Sequelize.STRING, unique: true },
        hospitalId: {
          type: Sequelize.UUID, allowNull: false,
          references: { model: 'Hospitals', key: 'id' },
          onUpdate: 'CASCADE', onDelete: 'CASCADE',
        },
        stockPurchaseId: {
          type: Sequelize.UUID, allowNull: false,
          references: { model: 'StockPurchases', key: 'id' },
          onUpdate: 'CASCADE', onDelete: 'CASCADE',
        },
        medicationId: {
          type: Sequelize.UUID, allowNull: false,
          references: { model: 'Medications', key: 'id' },
          onUpdate: 'CASCADE', onDelete: 'RESTRICT',
        },
        vendorId: {
          type: Sequelize.UUID, allowNull: true,
          references: { model: 'Vendors', key: 'id' },
          onUpdate: 'CASCADE', onDelete: 'SET NULL',
        },
        createdByUserId: {
          type: Sequelize.UUID, allowNull: true,
          references: { model: 'Users', key: 'id' },
          onUpdate: 'CASCADE', onDelete: 'SET NULL',
        },
        returnDate: { type: Sequelize.DATEONLY, allowNull: false },
        quantity: { type: Sequelize.INTEGER, allowNull: false },
        unitCost: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
        taxPct: { type: Sequelize.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
        taxableAmount: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
        taxAmount: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
        totalAmount: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
        reason: { type: Sequelize.STRING(200) },
        notes: { type: Sequelize.TEXT },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
      await queryInterface.addIndex('StockPurchaseReturns', ['hospitalId', 'returnDate']);
      await queryInterface.addIndex('StockPurchaseReturns', ['stockPurchaseId']);
      await queryInterface.addIndex('StockPurchaseReturns', ['medicationId']);
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('StockPurchaseReturns');
    await queryInterface.dropTable('MedicineInvoiceReturnItems');
    await queryInterface.dropTable('MedicineInvoiceReturns');
  },
};
