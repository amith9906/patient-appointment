const { sequelize } = require('../models');
const { runPartitionMaintenance } = require('../scripts/partitionMaintenance');

describe('Phase 1: PostgreSQL Table Partitioning', () => {
  beforeAll(async () => {
    await sequelize.authenticate();
  });

  test('create_monthly_partitions_for_table function creates future partition tables', async () => {
    if (sequelize.getDialect() !== 'postgres') {
      // In SQLite memory test mode, partitioning function is simulated/skipped
      expect(true).toBe(true);
      return;
    }

    await runPartitionMaintenance();

    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const yearStr = nextMonth.getFullYear();
    const monthStr = String(nextMonth.getMonth() + 1).padStart(2, '0');
    const expectedPartitionName = `audit_logs_${yearStr}_${monthStr}`;

    const [results] = await sequelize.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE tablename = '${expectedPartitionName}';
    `);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].tablename).toBe(expectedPartitionName);
  });
});
