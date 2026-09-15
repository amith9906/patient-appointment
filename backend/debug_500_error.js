const { Doctor, User } = require('./src/models');
const doctorController = require('./src/controllers/doctorController');
const appointmentController = require('./src/controllers/appointmentController');

async function testError() {
  const userA = await User.findOne({ where: { email: 'admin_hospital_a@test.com' } });
  const req = { user: userA, query: {} };
  const res = {
    statusCode: 200,
    status: function(code) { this.statusCode = code; return this; },
    json: function(data) { this.data = data; console.log('RESPONSE:', this.statusCode, data); return this; }
  };

  console.log('Testing Doctor getAll for Admin A:');
  await doctorController.getAll(req, res);

  console.log('\nTesting Appointment getAll for Admin A:');
  await appointmentController.getAll(req, res);

  process.exit(0);
}

testError().catch(console.error);
