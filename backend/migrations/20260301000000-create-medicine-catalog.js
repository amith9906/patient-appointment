'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Create MedicineCatalogs table
    await queryInterface.createTable('MedicineCatalogs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      genericName: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      composition: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      manufacturer: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      defaultItemType: {
        type: Sequelize.ENUM('tablet', 'capsule', 'syrup', 'injection', 'iv_fluid', 'consumable', 'procedure', 'cream', 'drops', 'inhaler', 'other'),
        defaultValue: 'tablet',
      },
      defaultUnit: {
        type: Sequelize.STRING(30),
        defaultValue: 'pcs',
      },
      isRestrictedDrug: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      hsnCode: {
        type: Sequelize.STRING(10),
        defaultValue: '3004',
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // 2. Enable pg_trgm extension if not exists
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS pg_trgm;');

    // 3. Create GIN Trigram index on MedicineCatalogs.name
    await queryInterface.sequelize.query(
      'CREATE INDEX IF NOT EXISTS idx_medicine_catalogs_name_trgm ON "MedicineCatalogs" USING gin ("name" gin_trgm_ops);'
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('MedicineCatalogs');
  },
};
