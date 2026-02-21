'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.createTable('CorporateAccounts', {
        id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
        hospitalId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'Hospitals', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        name: { type: Sequelize.STRING, allowNull: false },
        accountCode: { type: Sequelize.STRING(40) },
        gstin: { type: Sequelize.STRING(20) },
        contactPerson: { type: Sequelize.STRING(120) },
        phone: { type: Sequelize.STRING(30) },
        email: { type: Sequelize.STRING(120) },
        address: { type: Sequelize.TEXT },
        creditDays: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 30 },
        creditLimit: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
        openingBalance: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
        isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        notes: { type: Sequelize.TEXT },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      }, { transaction: t });

      await queryInterface.createTable('CorporateLedgerEntries', {
        id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
        hospitalId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'Hospitals', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        corporateAccountId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'CorporateAccounts', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        appointmentId: {
          type: Sequelize.UUID,
          references: { model: 'Appointments', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        entryType: {
          type: Sequelize.ENUM('opening', 'invoice', 'payment', 'adjustment'),
          allowNull: false,
        },
        entryDate: { type: Sequelize.DATEONLY, allowNull: false },
        referenceNumber: { type: Sequelize.STRING(80) },
        debitAmount: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
        creditAmount: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
        notes: { type: Sequelize.TEXT },
        createdByUserId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'Users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      }, { transaction: t });

      await queryInterface.addColumn('Appointments', 'corporateAccountId', {
        type: Sequelize.UUID,
        references: { model: 'CorporateAccounts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      }, { transaction: t });

      await queryInterface.addColumn('Appointments', 'corporateInvoiceNumber', {
        type: Sequelize.STRING(80),
      }, { transaction: t });

      await queryInterface.addColumn('Appointments', 'corporateInvoiceDate', {
        type: Sequelize.DATEONLY,
      }, { transaction: t });

      await queryInterface.addColumn('Appointments', 'corporateDueDate', {
        type: Sequelize.DATEONLY,
      }, { transaction: t });

      await queryInterface.addColumn('Appointments', 'corporatePaymentStatus', {
        type: Sequelize.ENUM('unbilled', 'billed', 'partially_paid', 'paid'),
        allowNull: false,
        defaultValue: 'unbilled',
      }, { transaction: t });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.removeColumn('Appointments', 'corporatePaymentStatus', { transaction: t });
      await queryInterface.removeColumn('Appointments', 'corporateDueDate', { transaction: t });
      await queryInterface.removeColumn('Appointments', 'corporateInvoiceDate', { transaction: t });
      await queryInterface.removeColumn('Appointments', 'corporateInvoiceNumber', { transaction: t });
      await queryInterface.removeColumn('Appointments', 'corporateAccountId', { transaction: t });
      await queryInterface.dropTable('CorporateLedgerEntries', { transaction: t });
      await queryInterface.dropTable('CorporateAccounts', { transaction: t });
    });
  },
};

