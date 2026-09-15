'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);

    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS global_search_index (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hospital_id INT NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id VARCHAR(100) NOT NULL,
        uhid VARCHAR(50),
        title VARCHAR(255) NOT NULL,
        subtitle VARCHAR(255),
        content TEXT NOT NULL,
        search_vector tsvector,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Create trigger to maintain tsvector search column
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_global_search_vector ON global_search_index USING gin(search_vector);
      CREATE INDEX IF NOT EXISTS idx_global_search_trgm ON global_search_index USING gin(content gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS idx_global_search_uhid ON global_search_index (uhid);
      CREATE INDEX IF NOT EXISTS idx_global_search_hospital ON global_search_index (hospital_id);
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS global_search_index CASCADE;`);
  }
};
