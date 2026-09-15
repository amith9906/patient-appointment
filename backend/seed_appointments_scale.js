const { sequelize, Doctor, Patient, Appointment } = require('./src/models');
const crypto = require('crypto');

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('Connected to DB.');

    // 1. Get existing count
    const [countResult] = await sequelize.query('SELECT COUNT(*) FROM "Appointments";');
    console.log('Initial Appointments Count:', countResult[0].count);

    // 2. Fetch doctors and patients
    let doctors = await Doctor.findAll({ attributes: ['id'] });
    let patients = await Patient.findAll({ attributes: ['id'] });

    const doctorIds = doctors.length > 0 
      ? doctors.map(d => d.id) 
      : ['a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33'];
    
    const patientIds = patients.length > 0 
      ? patients.map(p => p.id) 
      : ['d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55'];

    const statuses = ['scheduled', 'postponed', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'];
    const types = ['consultation', 'follow_up', 'emergency', 'routine_checkup', 'lab_test'];

    const targetTotal = 50000;
    const batchSize = 5000;
    console.log(`Seeding ${targetTotal} appointment records...`);

    const startDate = new Date('2025-01-01').getTime();
    const endDate = new Date('2026-12-31').getTime();

    for (let b = 0; b < targetTotal; b += batchSize) {
      const records = [];
      const nowIso = new Date().toISOString();
      for (let i = 0; i < batchSize; i++) {
        const idx = b + i + 1;
        const randomTime = new Date(startDate + Math.random() * (endDate - startDate));
        const dateStr = randomTime.toISOString().slice(0, 10);
        const doctorId = doctorIds[idx % doctorIds.length];
        const patientId = patientIds[idx % patientIds.length];
        const status = statuses[idx % statuses.length];
        const type = types[idx % types.length];

        records.push({
          id: crypto.randomUUID(),
          appointmentNumber: `APT-SCALE-${b + i + 1}-${crypto.randomBytes(2).toString('hex')}`,
          appointmentDate: dateStr,
          appointmentTime: '10:00:00',
          duration: 30,
          status,
          type,
          fee: 500.00,
          isPaid: idx % 2 === 0,
          doctorId,
          patientId,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }

      await Appointment.bulkCreate(records, { hooks: false, validate: false });
      console.log(`Inserted batch ${b / batchSize + 1} / ${targetTotal / batchSize} (${b + batchSize} rows)`);
    }

    const [finalCountResult] = await sequelize.query('SELECT COUNT(*) FROM "Appointments";');
    console.log('Final Appointments Count:', finalCountResult[0].count);

    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
}

seed();
