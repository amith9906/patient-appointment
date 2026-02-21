'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('MedicineInvoices', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },
      invoiceNumber: {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true,
      },
      invoiceDate: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_DATE'),
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
        allowNull: true,
        references: { model: 'Patients', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      soldByUserId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      subtotal: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      discountAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      taxAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      totalAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      paymentMode: {
        type: Sequelize.ENUM('cash', 'upi', 'card', 'net_banking', 'insurance', 'other'),
        defaultValue: 'cash',
      },
      isPaid: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.createTable('MedicineInvoiceItems', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },
      invoiceId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'MedicineInvoices', key: 'id' },
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
      batchNo: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      expiryDate: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      quantity: {
        type: Sequelize.DECIMAL(8, 2),
        allowNull: false,
      },
      unitPrice: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      discountPct: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
      },
      taxPct: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
      },
      lineSubtotal: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      lineDiscount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      lineTax: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      lineTotal: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('MedicineInvoices', ['hospitalId', 'invoiceDate']);
    await queryInterface.addIndex('MedicineInvoices', ['patientId']);
    await queryInterface.addIndex('MedicineInvoiceItems', ['invoiceId']);
    await queryInterface.addIndex('MedicineInvoiceItems', ['medicationId']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('MedicineInvoiceItems', ['medicationId']);
    await queryInterface.removeIndex('MedicineInvoiceItems', ['invoiceId']);
    await queryInterface.removeIndex('MedicineInvoices', ['patientId']);
    await queryInterface.removeIndex('MedicineInvoices', ['hospitalId', 'invoiceDate']);

    await queryInterface.dropTable('MedicineInvoiceItems');
    await queryInterface.dropTable('MedicineInvoices');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_MedicineInvoices_paymentMode";');
  },
};
