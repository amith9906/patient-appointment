const { sequelize } = require('./src/models');

async function run() {
  try {
    await sequelize.authenticate();

    console.log('=== 1A. EXPLAIN ANALYZE Appointments ===');
    const [res1] = await sequelize.query(`
      EXPLAIN ANALYZE
      SELECT * FROM "Appointments"
      WHERE "doctorId" = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND "appointmentDate" = '2026-09-15' AND "status" = 'scheduled';
    `);
    console.log(res1.map(r => r['QUERY PLAN']).join('\n'));

    console.log('\n=== 1B. EXPLAIN ANALYZE Medications ===');
    const [res2] = await sequelize.query(`
      EXPLAIN ANALYZE
      SELECT * FROM "Medications"
      WHERE "hospitalId" = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND "expiryDate" <= '2026-10-15';
    `);
    console.log(res2.map(r => r['QUERY PLAN']).join('\n'));

    console.log('\n=== 1C. Postgres Indexes on Appointments ===');
    const [idx1] = await sequelize.query(`
      SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'Appointments';
    `);
    console.log(JSON.stringify(idx1, null, 2));

    console.log('\n=== 1D. Postgres Indexes on Medications ===');
    const [idx2] = await sequelize.query(`
      SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'Medications';
    `);
    console.log(JSON.stringify(idx2, null, 2));

    process.exit(0);
  } catch (err) {
    console.error('DB Verify Error:', err);
    process.exit(1);
  }
}

run();
