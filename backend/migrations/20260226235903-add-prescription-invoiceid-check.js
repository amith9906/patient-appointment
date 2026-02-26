'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Count prescription reports without invoiceId
    const [[{ count }]] = await queryInterface.sequelize.query(
      "SELECT count(*)::int AS count FROM \"Reports\" WHERE type = 'prescription' AND \"invoiceId\" IS NULL;"
    );
    if (Number(count || 0) === 0) {
      await queryInterface.sequelize.query(
        "ALTER TABLE \"Reports\" ADD CONSTRAINT reports_prescription_invoiceid_not_null CHECK (type <> 'prescription' OR \"invoiceId\" IS NOT NULL);"
      );
    } else {
      // Do not fail migration; leave for manual backfill
      // eslint-disable-next-line no-console
      console.warn(`Skipping constraint: ${count} prescription report(s) without invoiceId found`);
    }
  },

  down: async (queryInterface) => {
    // Drop constraint if exists
    await queryInterface.sequelize.query(
      'ALTER TABLE "Reports" DROP CONSTRAINT IF EXISTS reports_prescription_invoiceid_not_null;'
    );
  },
};
