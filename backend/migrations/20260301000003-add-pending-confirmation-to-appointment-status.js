'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Add pending_confirmation to enum_Appointments_status if PostgreSQL
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_Appointments_status') THEN
          ALTER TYPE "enum_Appointments_status" ADD VALUE IF NOT EXISTS 'pending_confirmation';
        END IF;
      END
      $$;
    `);
  },

  async down() {
    // Enum value removal in Postgres is a no-op / non-destructive
  },
};
