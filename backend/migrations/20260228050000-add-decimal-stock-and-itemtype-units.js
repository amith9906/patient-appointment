'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add new enum values to category enum
    await queryInterface.sequelize.query('ALTER TYPE "enum_Medications_category" ADD VALUE IF NOT EXISTS \'iv_fluid\';').catch(() => {});
    await queryInterface.sequelize.query('ALTER TYPE "enum_Medications_category" ADD VALUE IF NOT EXISTS \'consumable\';').catch(() => {});
    await queryInterface.sequelize.query('ALTER TYPE "enum_Medications_category" ADD VALUE IF NOT EXISTS \'procedure\';').catch(() => {});

    // 2. Add itemType and unit columns
    await queryInterface.sequelize.query('ALTER TABLE "Medications" ADD COLUMN IF NOT EXISTS "itemType" VARCHAR(40) DEFAULT \'tablet\';');
    await queryInterface.sequelize.query('ALTER TABLE "Medications" ADD COLUMN IF NOT EXISTS "unit" VARCHAR(30) DEFAULT \'pcs\';');

    await queryInterface.sequelize.query('ALTER TABLE "MedicineInvoiceItems" ADD COLUMN IF NOT EXISTS "itemType" VARCHAR(40) DEFAULT \'tablet\';');
    await queryInterface.sequelize.query('ALTER TABLE "MedicineInvoiceItems" ADD COLUMN IF NOT EXISTS "unit" VARCHAR(30) DEFAULT \'pcs\';');

    await queryInterface.sequelize.query('ALTER TABLE "BillItems" ADD COLUMN IF NOT EXISTS "medicationId" UUID NULL;');
    await queryInterface.sequelize.query('ALTER TABLE "BillItems" ADD COLUMN IF NOT EXISTS "itemType" VARCHAR(40) DEFAULT \'other\';');
    await queryInterface.sequelize.query('ALTER TABLE "BillItems" ADD COLUMN IF NOT EXISTS "unit" VARCHAR(30) DEFAULT \'pcs\';');

    // 3. Alter integer stock columns to DECIMAL(10, 2)
    await queryInterface.sequelize.query('ALTER TABLE "Medications" ALTER COLUMN "stockQuantity" TYPE NUMERIC(10, 2) USING "stockQuantity"::NUMERIC(10, 2);');
    await queryInterface.sequelize.query('ALTER TABLE "MedicationBatches" ALTER COLUMN "quantityOnHand" TYPE NUMERIC(10, 2) USING "quantityOnHand"::NUMERIC(10, 2);');
    await queryInterface.sequelize.query('ALTER TABLE "StockLedgerEntries" ALTER COLUMN "quantityIn" TYPE NUMERIC(10, 2) USING "quantityIn"::NUMERIC(10, 2);');
    await queryInterface.sequelize.query('ALTER TABLE "StockLedgerEntries" ALTER COLUMN "quantityOut" TYPE NUMERIC(10, 2) USING "quantityOut"::NUMERIC(10, 2);');
    await queryInterface.sequelize.query('ALTER TABLE "StockLedgerEntries" ALTER COLUMN "balanceAfter" TYPE NUMERIC(10, 2) USING "balanceAfter"::NUMERIC(10, 2);');
  },

  async down(queryInterface, Sequelize) {
    // Revert columns
    await queryInterface.removeColumn('Medications', 'itemType').catch(() => {});
    await queryInterface.removeColumn('Medications', 'unit').catch(() => {});
    await queryInterface.removeColumn('MedicineInvoiceItems', 'itemType').catch(() => {});
    await queryInterface.removeColumn('MedicineInvoiceItems', 'unit').catch(() => {});
    await queryInterface.removeColumn('BillItems', 'medicationId').catch(() => {});
    await queryInterface.removeColumn('BillItems', 'itemType').catch(() => {});
    await queryInterface.removeColumn('BillItems', 'unit').catch(() => {});
  }
};
