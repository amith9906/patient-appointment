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

    if (tableNames.includes('doctors')) {
      try {
        await queryInterface.changeColumn('Doctors', 'signatureUrl', {
          type: Sequelize.TEXT,
          allowNull: true,
        });
      } catch (err) {
        console.log('Migration changeColumn Doctors.signatureUrl notice:', err.message);
      }
    }

    if (tableNames.includes('hospitalsettings')) {
      try {
        const columns = await queryInterface.describeTable('HospitalSettings');
        if (!columns.doctorSignatureUrl) {
          await queryInterface.addColumn('HospitalSettings', 'doctorSignatureUrl', {
            type: Sequelize.TEXT,
            allowNull: true,
          });
        } else {
          await queryInterface.changeColumn('HospitalSettings', 'doctorSignatureUrl', {
            type: Sequelize.TEXT,
            allowNull: true,
          });
        }
      } catch (err) {
        console.log('Migration HospitalSettings.doctorSignatureUrl notice:', err.message);
      }
    }
  },

  async down(queryInterface, Sequelize) {
    // No-op for safety
  },
};
