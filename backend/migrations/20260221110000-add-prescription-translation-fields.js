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
    const hasTable = tables.some((tableName) => normalizeTableName(tableName) === 'prescriptions');
    if (!hasTable) return;

    const columns = await queryInterface.describeTable('Prescriptions');

    if (!columns.instructionsOriginal) {
      await queryInterface.addColumn('Prescriptions', 'instructionsOriginal', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    if (!columns.translatedInstructions) {
      await queryInterface.addColumn('Prescriptions', 'translatedInstructions', {
        type: Sequelize.JSONB,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const hasTable = tables.some((tableName) => normalizeTableName(tableName) === 'prescriptions');
    if (!hasTable) return;

    const columns = await queryInterface.describeTable('Prescriptions');

    if (columns.translatedInstructions) {
      await queryInterface.removeColumn('Prescriptions', 'translatedInstructions');
    }

    if (columns.instructionsOriginal) {
      await queryInterface.removeColumn('Prescriptions', 'instructionsOriginal');
    }
  },
};
