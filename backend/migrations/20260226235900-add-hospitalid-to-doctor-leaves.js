"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    if (tables.includes('DoctorLeaves')) {
      // 1) Add nullable column so existing rows can be backfilled
      await queryInterface.addColumn('DoctorLeaves', 'hospitalId', {
        type: Sequelize.UUID,
        allowNull: true,
      });

      // 2) Backfill hospitalId from Doctors table (assumes Doctor has hospitalId)
      await queryInterface.sequelize.query(
        `UPDATE "DoctorLeaves" dl
         SET "hospitalId" = d."hospitalId"
         FROM "Doctors" d
         WHERE dl."doctorId" = d.id AND dl."hospitalId" IS NULL;`
      );

      // 3) If no nulls remain, make the column NOT NULL and add FK constraint
      const [results] = await queryInterface.sequelize.query(
        `SELECT COUNT(*)::int AS count FROM "DoctorLeaves" WHERE "hospitalId" IS NULL;`
      );
      const nullCount = results && results[0] ? parseInt(results[0].count, 10) : 0;
      if (nullCount === 0) {
        await queryInterface.changeColumn('DoctorLeaves', 'hospitalId', {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'Hospitals', key: 'id' },
          onDelete: 'CASCADE',
        });
      } else {
        // Leave as nullable so migration doesn't fail; operator can inspect/clean remaining rows
        // Optionally add FK constraint separately if desired.
        // eslint-disable-next-line no-console
        console.warn(`${nullCount} DoctorLeaves rows could not be backfilled with hospitalId`);
      }
    }
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    if (tables.includes('DoctorLeaves')) {
      await queryInterface.removeColumn('DoctorLeaves', 'hospitalId');
    }
  },
};
