'use strict';

function normalizeTableName(tableName) {
  if (typeof tableName === 'string') return tableName.toLowerCase();
  if (tableName && typeof tableName === 'object') {
    return String(tableName.tableName || tableName.tablename || '').toLowerCase();
  }
  return '';
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const tableNames = tables.map(normalizeTableName);

    // BillItems table
    if (tableNames.includes('billitems')) {
      const cols = await queryInterface.describeTable('BillItems');
      if (!cols.sacCode) await queryInterface.addColumn('BillItems', 'sacCode', { type: Sequelize.STRING(20), defaultValue: '999312' });
      if (!cols.cgstAmount) await queryInterface.addColumn('BillItems', 'cgstAmount', { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 });
      if (!cols.sgstAmount) await queryInterface.addColumn('BillItems', 'sgstAmount', { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 });
      if (!cols.igstAmount) await queryInterface.addColumn('BillItems', 'igstAmount', { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 });
    }

    // IPDBillItems table
    if (tableNames.includes('ipdbillitems')) {
      const cols = await queryInterface.describeTable('IPDBillItems');
      if (!cols.sacCode) await queryInterface.addColumn('IPDBillItems', 'sacCode', { type: Sequelize.STRING(20), defaultValue: '999311' });
      if (!cols.cgstAmount) await queryInterface.addColumn('IPDBillItems', 'cgstAmount', { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 });
      if (!cols.sgstAmount) await queryInterface.addColumn('IPDBillItems', 'sgstAmount', { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 });
      if (!cols.igstAmount) await queryInterface.addColumn('IPDBillItems', 'igstAmount', { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 });
    }

    // MedicineInvoices table
    if (tableNames.includes('medicineinvoices')) {
      const cols = await queryInterface.describeTable('MedicineInvoices');
      if (!cols.cgstAmount) await queryInterface.addColumn('MedicineInvoices', 'cgstAmount', { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 });
      if (!cols.sgstAmount) await queryInterface.addColumn('MedicineInvoices', 'sgstAmount', { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 });
      if (!cols.igstAmount) await queryInterface.addColumn('MedicineInvoices', 'igstAmount', { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 });
      if (!cols.isInterstate) await queryInterface.addColumn('MedicineInvoices', 'isInterstate', { type: Sequelize.BOOLEAN, defaultValue: false });
    }

    // MedicineInvoiceItems table
    if (tableNames.includes('medicineinvoiceitems')) {
      const cols = await queryInterface.describeTable('MedicineInvoiceItems');
      if (!cols.hsnCode) await queryInterface.addColumn('MedicineInvoiceItems', 'hsnCode', { type: Sequelize.STRING(20), defaultValue: '30049099' });
      if (!cols.cgstAmount) await queryInterface.addColumn('MedicineInvoiceItems', 'cgstAmount', { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 });
      if (!cols.sgstAmount) await queryInterface.addColumn('MedicineInvoiceItems', 'sgstAmount', { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 });
      if (!cols.igstAmount) await queryInterface.addColumn('MedicineInvoiceItems', 'igstAmount', { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 });
    }
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const tableNames = tables.map(normalizeTableName);

    if (tableNames.includes('billitems')) {
      await queryInterface.removeColumn('BillItems', 'sacCode');
      await queryInterface.removeColumn('BillItems', 'cgstAmount');
      await queryInterface.removeColumn('BillItems', 'sgstAmount');
      await queryInterface.removeColumn('BillItems', 'igstAmount');
    }
    if (tableNames.includes('ipdbillitems')) {
      await queryInterface.removeColumn('IPDBillItems', 'sacCode');
      await queryInterface.removeColumn('IPDBillItems', 'cgstAmount');
      await queryInterface.removeColumn('IPDBillItems', 'sgstAmount');
      await queryInterface.removeColumn('IPDBillItems', 'igstAmount');
    }
    if (tableNames.includes('medicineinvoices')) {
      await queryInterface.removeColumn('MedicineInvoices', 'cgstAmount');
      await queryInterface.removeColumn('MedicineInvoices', 'sgstAmount');
      await queryInterface.removeColumn('MedicineInvoices', 'igstAmount');
      await queryInterface.removeColumn('MedicineInvoices', 'isInterstate');
    }
    if (tableNames.includes('medicineinvoiceitems')) {
      await queryInterface.removeColumn('MedicineInvoiceItems', 'hsnCode');
      await queryInterface.removeColumn('MedicineInvoiceItems', 'cgstAmount');
      await queryInterface.removeColumn('MedicineInvoiceItems', 'sgstAmount');
      await queryInterface.removeColumn('MedicineInvoiceItems', 'igstAmount');
    }
  },
};
