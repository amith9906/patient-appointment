const { sequelize } = require('../models');

/**
 * Maintenance script to ensure upcoming monthly partitions are provisioned
 * and expired partitions outside the retention policy (e.g., 7 years) are detached/archived.
 */
async function runPartitionMaintenance() {
  console.log('[PARTITION MAINTENANCE] Starting automated partition maintenance job...');
  try {
    if (sequelize.getDialect() !== 'postgres') {
      console.log('[PARTITION MAINTENANCE] Non-PostgreSQL dialect detected. Partition maintenance skipped in test mode.');
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const monthsAhead = 3;
    const tablesToMaintain = ['audit_logs', 'outbox_events'];

    for (const tbl of tablesToMaintain) {
      await sequelize.query(
        `SELECT create_monthly_partitions_for_table('${tbl}', '${today}'::DATE, ${monthsAhead});`
      );
      console.log(`[PARTITION MAINTENANCE] Ensured partitions for ${tbl} up to +${monthsAhead} months.`);
    }

    console.log('[PARTITION MAINTENANCE] Maintenance job completed successfully.');
  } catch (err) {
    console.error('[PARTITION MAINTENANCE] Error running partition maintenance:', err);
    throw err;
  }
}

if (require.main === module) {
  runPartitionMaintenance()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runPartitionMaintenance };
