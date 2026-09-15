const { sequelize } = require('./src/models');

async function run() {
  try {
    await sequelize.authenticate();

    console.log('=== 1. Current Row Count ===');
    const [countRes] = await sequelize.query('SELECT COUNT(*) FROM "Appointments";');
    console.log(`SELECT COUNT(*) FROM "Appointments";\nOutput: ${countRes[0].count} rows\n`);

    console.log('=== 2. Updating Postgres Statistics (ANALYZE "Appointments";) ===');
    await sequelize.query('ANALYZE "Appointments";');
    console.log('ANALYZE "Appointments"; completed.\n');

    // Get a real doctorId and appointmentDate from the database
    const [sampleRow] = await sequelize.query(`
      SELECT "doctorId", "appointmentDate" FROM "Appointments"
      WHERE status = 'scheduled' LIMIT 1;
    `);

    const doctorId = sampleRow[0]?.doctorId;
    const appointmentDate = sampleRow[0]?.appointmentDate;

    console.log(`Selected Real Test Sample: doctorId = '${doctorId}', appointmentDate = '${appointmentDate}'\n`);

    console.log('=== 3. Raw EXPLAIN ANALYZE Output ===');
    const explainQuery = `
EXPLAIN ANALYZE
SELECT * FROM "Appointments"
WHERE "doctorId" = '${doctorId}'
  AND "appointmentDate" = '${appointmentDate}'
  AND "status" = 'scheduled';
    `;
    console.log(explainQuery);
    const [explainRes] = await sequelize.query(explainQuery);
    console.log(explainRes.map(r => r['QUERY PLAN']).join('\n'));

    console.log('\n=== 4. Redundant Indexes & Cleanup SQL ===');
    const [indexes] = await sequelize.query(`
      SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'Appointments';
    `);
    console.log(JSON.stringify(indexes, null, 2));

    process.exit(0);
  } catch (err) {
    console.error('Benchmark Error:', err);
    process.exit(1);
  }
}

run();
