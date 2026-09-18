'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Create partition maintenance helper function in PostgreSQL
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION create_monthly_partitions_for_table(
        parent_table TEXT,
        start_date DATE,
        months_ahead INT
      ) RETURNS VOID AS $$
      DECLARE
        i INT;
        curr_dt DATE;
        start_str TEXT;
        end_str TEXT;
        partition_name TEXT;
      BEGIN
        FOR i IN 0..months_ahead LOOP
          curr_dt := start_date + (i || ' month')::INTERVAL;
          start_str := to_char(date_trunc('month', curr_dt), 'YYYY-MM-DD');
          end_str := to_char(date_trunc('month', curr_dt + '1 month'::INTERVAL), 'YYYY-MM-DD');
          partition_name := parent_table || '_' || to_char(curr_dt, 'YYYY_MM');

          EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L);',
            partition_name,
            parent_table,
            start_str,
            end_str
          );
        END LOOP;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // 2. Ensure AuditLogs table has dynamic partitions if created natively
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID NOT NULL,
        hospital_id UUID REFERENCES "Hospitals"("id") ON DELETE SET NULL,
        user_id UUID,
        user_role VARCHAR(50),
        action VARCHAR(100) NOT NULL,
        entity VARCHAR(100) NOT NULL,
        entity_id VARCHAR(100),
        ip_address VARCHAR(45),
        details JSONB,
        created_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (id, created_at)
      ) PARTITION BY RANGE (created_at);
    `);

    // 3. OutboxEvents table for async event publishing pattern
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS outbox_events (
        id UUID NOT NULL,
        hospital_id UUID,
        aggregate_type VARCHAR(100) NOT NULL,
        aggregate_id VARCHAR(100) NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        payload JSONB NOT NULL,
        processed BOOLEAN DEFAULT FALSE,
        processed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (id, created_at)
      ) PARTITION BY RANGE (created_at);
    `);

    // Generate monthly partitions for 12 past months and next 12 months
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);
    const monthsAhead = 18;
    const formattedStartDate = startDate.toISOString().slice(0, 10);

    await queryInterface.sequelize.query(
      `SELECT create_monthly_partitions_for_table('audit_logs', '${formattedStartDate}'::DATE, ${monthsAhead});`
    );
    await queryInterface.sequelize.query(
      `SELECT create_monthly_partitions_for_table('outbox_events', '${formattedStartDate}'::DATE, ${monthsAhead});`
    );

    // Create partition-aware composite performance indexes
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_hospital_date ON audit_logs (hospital_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_outbox_unprocessed ON outbox_events (processed, created_at ASC) WHERE processed = FALSE;
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS audit_logs CASCADE;`);
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS outbox_events CASCADE;`);
    await queryInterface.sequelize.query(`DROP FUNCTION IF EXISTS create_monthly_partitions_for_table(TEXT, DATE, INT);`);
  }
};
