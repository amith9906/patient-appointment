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
    const hasDoctorsTable = tables.some((tableName) => normalizeTableName(tableName) === 'doctors');
    if (!hasDoctorsTable) return;

    const columns = await queryInterface.describeTable('Doctors');

    if (!columns.signatureUrl) {
      await queryInterface.addColumn('Doctors', 'signatureUrl', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const hasDoctorsTable = tables.some((tableName) => normalizeTableName(tableName) === 'doctors');
    if (!hasDoctorsTable) return;

    const columns = await queryInterface.describeTable('Doctors');

    if (columns.signatureUrl) {
      await queryInterface.removeColumn('Doctors', 'signatureUrl');
    }
  },
};
