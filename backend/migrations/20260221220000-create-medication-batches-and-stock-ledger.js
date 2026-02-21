'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.createTable('MedicationBatches', {
        id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
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
          onDelete: 'CASCADE',
        },
        batchNo: { type: Sequelize.STRING(60), allowNull: false },
        mfgDate: { type: Sequelize.DATEONLY },
        expiryDate: { type: Sequelize.DATEONLY, allowNull: false },
        purchaseDate: { type: Sequelize.DATEONLY },
        quantityOnHand: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        unitCost: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
        isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        notes: { type: Sequelize.TEXT },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      }, { transaction: t });

      await queryInterface.addIndex('MedicationBatches', ['hospitalId', 'medicationId', 'batchNo'], {
        unique: true,
        name: 'med_batch_unique_per_hospital_med',
        transaction: t,
      });
      await queryInterface.addIndex('MedicationBatches', ['medicationId', 'expiryDate'], {
        name: 'med_batch_expiry_idx',
        transaction: t,
      });

      await queryInterface.createTable('StockLedgerEntries', {
        id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
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
          onDelete: 'CASCADE',
        },
        batchId: {
          type: Sequelize.UUID,
          references: { model: 'MedicationBatches', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        entryDate: { type: Sequelize.DATEONLY, allowNull: false },
        entryType: {
          type: Sequelize.ENUM(
            'opening',
            'purchase',
            'sale',
            'manual_add',
            'manual_subtract',
            'purchase_return',
            'sales_return'
          ),
          allowNull: false,
        },
        quantityIn: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        quantityOut: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        balanceAfter: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        referenceType: { type: Sequelize.STRING(40) },
        referenceId: { type: Sequelize.UUID },
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

      await queryInterface.addIndex('StockLedgerEntries', ['hospitalId', 'medicationId', 'entryDate'], {
        name: 'stock_ledger_hosp_med_date_idx',
        transaction: t,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.dropTable('StockLedgerEntries', { transaction: t });
      await queryInterface.dropTable('MedicationBatches', { transaction: t });
    });
  },
};

