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
    const hasAppointmentsTable = tables.some((tableName) => normalizeTableName(tableName) === 'appointments');
    if (!hasAppointmentsTable) return;

    const columns = await queryInterface.describeTable('Appointments');

    if (!columns.treatmentDone) {
      await queryInterface.addColumn('Appointments', 'treatmentDone', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    if (!columns.treatmentBill) {
      await queryInterface.addColumn('Appointments', 'treatmentBill', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
      });
    }
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const hasAppointmentsTable = tables.some((tableName) => normalizeTableName(tableName) === 'appointments');
    if (!hasAppointmentsTable) return;

    const columns = await queryInterface.describeTable('Appointments');

    if (columns.treatmentBill) {
      await queryInterface.removeColumn('Appointments', 'treatmentBill');
    }

    if (columns.treatmentDone) {
      await queryInterface.removeColumn('Appointments', 'treatmentDone');
    }
  },
};
