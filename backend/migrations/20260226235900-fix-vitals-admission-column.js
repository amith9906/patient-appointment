'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = 'Vitals';
    // Describe table to determine existing columns
    const desc = await queryInterface.describeTable(table).catch(() => ({}));

    // Decide which column name to use (camelCase or snake_case)
    let colName = null;
    if (desc && desc.admissionId) colName = 'admissionId';
    else if (desc && desc.admission_id) colName = 'admission_id';

    // If the column is missing, add camelCase `admissionId` (matches migrations)
    if (!colName) {
      await queryInterface.addColumn(table, 'admissionId', {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'IPDAdmissions',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      });
      colName = 'admissionId';
    }

    // Ensure index exists (avoid duplicate index errors)
    const existingIndexes = await queryInterface.showIndex(table).catch(() => []);
    const hasIndex = existingIndexes.some(ix => ix.name === 'vitals_admission_id' || (ix.fields && ix.fields.some(f => f.attribute === colName || f.column === colName)));
    if (!hasIndex) {
      await queryInterface.addIndex(table, [colName], { name: 'vitals_admission_id' });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const table = 'Vitals';
    // Remove the index if present, but do not drop the column to avoid data loss
    try {
      await queryInterface.removeIndex(table, 'vitals_admission_id');
    } catch (e) {
      // ignore
    }
  }
};
