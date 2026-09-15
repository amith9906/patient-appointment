const { Doctor, Hospital } = require('./src/models');

async function seedAndVerifyDoctors() {
  const hospA_id = 'b7be674a-6839-4c51-a005-9608952bbb8b';
  const hospB_id = '10985697-f62b-485d-9b3f-3460410c8bd7';

  // Check doctors for Hospital B
  let doctorsB = await Doctor.findAll({ where: { hospitalId: hospB_id }, raw: true });
  if (doctorsB.length < 3) {
    console.log(`Hospital B has ${doctorsB.length} doctors. Seeding 3 doctors for Hospital B (${hospB_id})...`);
    await Doctor.bulkCreate([
      {
        name: 'Dr. Suresh Kumar (Hospital B)',
        specialization: 'Cardiology',
        qualification: 'MBBS, MD',
        phone: '9876543210',
        email: 'suresh_b@sanjeevini.com',
        consultationFee: 700,
        hospitalId: hospB_id,
        isActive: true
      },
      {
        name: 'Dr. Anita Sharma (Hospital B)',
        specialization: 'Neurology',
        qualification: 'MBBS, DM',
        phone: '9876543211',
        email: 'anita_b@sanjeevini.com',
        consultationFee: 850,
        hospitalId: hospB_id,
        isActive: true
      },
      {
        name: 'Dr. Vikram Rao (Hospital B)',
        specialization: 'Orthopedics',
        qualification: 'MBBS, MS',
        phone: '9876543212',
        email: 'vikram_b@sanjeevini.com',
        consultationFee: 600,
        hospitalId: hospB_id,
        isActive: true
      }
    ]);
  }

  // Direct SQL query verification output
  const allDoctors = await Doctor.findAll({
    where: { hospitalId: [hospA_id, hospB_id] },
    attributes: ['id', 'name', 'specialization', 'hospitalId'],
    raw: true
  });

  console.log('\n=== DIRECT DB QUERY OUTPUT ===');
  console.log('SELECT id, name, specialization, "hospitalId" FROM "Doctors" WHERE "hospitalId" IN (\'b7be674a-6839-4c51-a005-9608952bbb8b\', \'10985697-f62b-485d-9b3f-3460410c8bd7\');');
  console.log(JSON.stringify(allDoctors, null, 2));

  process.exit(0);
}

seedAndVerifyDoctors().catch(console.error);
