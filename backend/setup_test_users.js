const { User } = require('./src/models');

async function setupUsers() {
  // User 1: Admin for Hospital A (Dr Nalla's)
  let userA = await User.findOne({ where: { email: 'admin_hospital_a@test.com' } });
  if (!userA) {
    userA = await User.create({
      name: 'Admin Hospital A',
      email: 'admin_hospital_a@test.com',
      password: 'Password123!',
      role: 'admin',
      hospitalId: 'b7be674a-6839-4c51-a005-9608952bbb8b',
      isActive: true
    });
  }

  // User 2: Admin for Hospital B (Sanjeevini)
  let userB = await User.findOne({ where: { email: 'admin_hospital_b@test.com' } });
  if (!userB) {
    userB = await User.create({
      name: 'Admin Hospital B',
      email: 'admin_hospital_b@test.com',
      password: 'Password123!',
      role: 'admin',
      hospitalId: '10985697-f62b-485d-9b3f-3460410c8bd7',
      isActive: true
    });
  }

  // User 3: Patient for Hospital A
  let userPatient = await User.findOne({ where: { email: 'patient_hospital_a@test.com' } });
  if (!userPatient) {
    userPatient = await User.create({
      name: 'Patient User A',
      email: 'patient_hospital_a@test.com',
      password: 'Password123!',
      role: 'patient',
      hospitalId: 'b7be674a-6839-4c51-a005-9608952bbb8b',
      isActive: true
    });
  }

  console.log('Test Users Ready:');
  console.log('Admin A:', { id: userA.id, email: userA.email, hospitalId: userA.hospitalId, role: userA.role });
  console.log('Admin B:', { id: userB.id, email: userB.email, hospitalId: userB.hospitalId, role: userB.role });
  console.log('Patient A:', { id: userPatient.id, email: userPatient.email, hospitalId: userPatient.hospitalId, role: userPatient.role });
  process.exit(0);
}

setupUsers().catch(console.error);
