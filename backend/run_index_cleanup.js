const { sequelize } = require('./src/models');

async function checkAndDropIndexes() {
  console.log('=== BEFORE: Index Query ===');
  const [beforeIndexes] = await sequelize.query(`SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'Appointments';`);
  console.log(JSON.stringify(beforeIndexes, null, 2));

  console.log('\n=== EXECUTING DROP CONSTRAINT AND DROP INDEX STATEMENTS ===');
  await sequelize.query(`ALTER TABLE "Appointments" DROP CONSTRAINT IF EXISTS "Appointments_appointmentNumber_key1";`);
  await sequelize.query(`ALTER TABLE "Appointments" DROP CONSTRAINT IF EXISTS "Appointments_appointmentNumber_key2";`);
  await sequelize.query(`ALTER TABLE "Appointments" DROP CONSTRAINT IF EXISTS "Appointments_appointmentNumber_key3";`);
  await sequelize.query(`DROP INDEX IF EXISTS "appointments_doctor_date_idx";`);
  console.log('DROP CONSTRAINT / DROP INDEX execution completed successfully.');

  console.log('\n=== AFTER: Index Query ===');
  const [afterIndexes] = await sequelize.query(`SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'Appointments';`);
  console.log(JSON.stringify(afterIndexes, null, 2));

  process.exit(0);
}

checkAndDropIndexes().catch((err) => {
  console.error('Execution Error:', err);
  process.exit(1);
});
