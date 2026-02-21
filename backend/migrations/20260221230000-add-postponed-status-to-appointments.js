'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_enum e ON t.oid = e.enumtypid
          WHERE t.typname = 'enum_Appointments_status'
            AND e.enumlabel = 'postponed'
        ) THEN
          ALTER TYPE "enum_Appointments_status" ADD VALUE 'postponed';
        END IF;
      END
      $$;
    `);
  },

  async down() {
    // Postgres does not support removing a single enum value safely in-place.
  },
};

