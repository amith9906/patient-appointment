const { User, Doctor, Hospital } = require('./src/models');

async function findUsers() {
  const users = await User.findAll({ limit: 10, raw: true });
  console.log('Sample Users from DB:', users.map(u => ({ id: u.id, email: u.email, role: u.role, hospitalId: u.hospitalId })));
  const hospitals = await Hospital.findAll({ limit: 5, raw: true });
  console.log('Sample Hospitals from DB:', hospitals.map(h => ({ id: h.id, name: h.name })));
  process.exit(0);
}

findUsers().catch(console.error);
