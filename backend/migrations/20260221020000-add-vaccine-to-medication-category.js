'use strict';

module.exports = {
  async up(queryInterface) {
    // PostgreSQL ENUM: safe ADD VALUE IF NOT EXISTS (no table recreation)
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_Medications_category" ADD VALUE IF NOT EXISTS 'vaccine';`
    );
  },

  async down() {
    // PostgreSQL does not support removing ENUM values without recreating the type.
    // No-op rollback is intentional.
  },
};
