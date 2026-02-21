'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('Medications');

    if (!cols.hsnCode) {
      await queryInterface.addColumn('Medications', 'hsnCode', {
        type: Sequelize.STRING(10),
        allowNull: true,
        comment: 'HSN code for GST classification (e.g. 3004 for medicines)',
      });
    }
    if (!cols.barcode) {
      await queryInterface.addColumn('Medications', 'barcode', {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'EAN/UPC barcode for scanning',
      });
    }
    if (!cols.supplierName) {
      await queryInterface.addColumn('Medications', 'supplierName', {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Default supplier / vendor name',
      });
    }
    if (!cols.purchasePrice) {
      await queryInterface.addColumn('Medications', 'purchasePrice', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: null,
        comment: 'Cost price (purchase price from supplier)',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Medications', 'hsnCode');
    await queryInterface.removeColumn('Medications', 'barcode');
    await queryInterface.removeColumn('Medications', 'supplierName');
    await queryInterface.removeColumn('Medications', 'purchasePrice');
  },
};
