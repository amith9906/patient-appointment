require('d:/Doc/backend/node_modules/dotenv').config({ path: 'd:/Doc/backend/.env' });
const { Appointment, Doctor, Patient, Hospital, User, sequelize } = require('../backend/src/models');
const { getWaitTimeAnalytics } = require('../backend/src/controllers/reportController');

async function testWaitTimeAnalytics() {
  console.log('=== TEST: Wait-Time Analytics Dashboard & Scoping ===');

  try {
    // 1. Create or fetch test hospitals
    const [hospA] = await Hospital.findOrCreate({
      where: { name: 'WaitTime Test Hospital A' },
      defaults: { code: 'WTA', address: '123 Test St', phone: '1112223333' },
    });
    const [hospB] = await Hospital.findOrCreate({
      where: { name: 'WaitTime Test Hospital B' },
      defaults: { code: 'WTB', address: '456 Test Ave', phone: '4445556666' },
    });

    // 2. Create test doctors
    const [docA] = await Doctor.findOrCreate({
      where: { name: 'Dr. Wait A', hospitalId: hospA.id },
      defaults: { specialization: 'General Medicine', fee: 500, phone: '9998887771' },
    });
    const [docB] = await Doctor.findOrCreate({
      where: { name: 'Dr. Wait B', hospitalId: hospB.id },
      defaults: { specialization: 'Cardiology', fee: 800, phone: '9998887772' },
    });

    // 3. Create test patients
    const [patA] = await Patient.findOrCreate({
      where: { name: 'Wait Patient A', hospitalId: hospA.id },
      defaults: { patientId: `P-WTA-${Date.now()}`, gender: 'male', dateOfBirth: '1990-01-01', phone: '9876543210' },
    });
    const [patB] = await Patient.findOrCreate({
      where: { name: 'Wait Patient B', hospitalId: hospB.id },
      defaults: { patientId: `P-WTB-${Date.now()}`, gender: 'female', dateOfBirth: '1992-02-02', phone: '9876543211' },
    });

    // 4. Create test appointments with timestamps
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Appt 1: Hosp A - Checked in 30 mins ago, consultation started 15 mins ago, completed now
    // Wait time: 15 mins, Consultation duration: 15 mins
    const appt1 = await Appointment.create({
      appointmentNumber: `APPT-WTA-1-${Date.now()}`,
      doctorId: docA.id,
      patientId: patA.id,
      appointmentDate: todayStr,
      appointmentTime: '10:00',
      status: 'completed',
      checkedInAt: new Date(now.getTime() - 30 * 60 * 1000),
      consultationStartedAt: new Date(now.getTime() - 15 * 60 * 1000),
      completedAt: now,
    });

    // Appt 2: Hosp A - Checked in 45 mins ago, consultation started 25 mins ago, completed 5 mins ago
    // Wait time: 20 mins, Consultation duration: 20 mins
    const appt2 = await Appointment.create({
      appointmentNumber: `APPT-WTA-2-${Date.now()}`,
      doctorId: docA.id,
      patientId: patA.id,
      appointmentDate: todayStr,
      appointmentTime: '10:30',
      status: 'completed',
      checkedInAt: new Date(now.getTime() - 45 * 60 * 1000),
      consultationStartedAt: new Date(now.getTime() - 25 * 60 * 1000),
      completedAt: new Date(now.getTime() - 5 * 60 * 1000),
    });

    // Appt 3: Hosp B - Checked in 60 mins ago, consultation started 10 mins ago, completed now
    // Wait time: 50 mins, Consultation duration: 10 mins
    const appt3 = await Appointment.create({
      appointmentNumber: `APPT-WTB-1-${Date.now()}`,
      doctorId: docB.id,
      patientId: patB.id,
      appointmentDate: todayStr,
      appointmentTime: '11:00',
      status: 'completed',
      checkedInAt: new Date(now.getTime() - 60 * 60 * 1000),
      consultationStartedAt: new Date(now.getTime() - 10 * 60 * 1000),
      completedAt: now,
    });

    console.log(`Created test appointments: Appt1 (${appt1.id}), Appt2 (${appt2.id}), Appt3 (${appt3.id})`);

    // Helper mock req/res
    const mockRes = () => {
      const res = {};
      res.status = (code) => { res.statusCode = code; return res; };
      res.json = (data) => { res.jsonData = data; return res; };
      return res;
    };

    // Test A: Query as Hospital A admin
    const reqHospA = {
      user: { role: 'admin', hospitalId: hospA.id },
      query: { from: todayStr, to: todayStr },
    };
    const resA = mockRes();
    await getWaitTimeAnalytics(reqHospA, resA);

    console.log('\n--- Hospital A Wait-Time Analytics Result ---');
    console.log('Summary:', JSON.stringify(resA.jsonData.summary, null, 2));
    console.log('DoctorWise:', JSON.stringify(resA.jsonData.doctorWise, null, 2));

    // Validation for Hosp A
    // Total appointments for Hosp A: 2
    // Avg wait time: (15 + 20) / 2 = 17.5 mins
    // Avg consultation duration: (15 + 20) / 2 = 17.5 mins
    if (resA.jsonData.summary.trackedWaitTimesCount >= 2) {
      console.log('✅ Hosp A tracked wait times count verified!');
    } else {
      console.error('❌ Hosp A tracked wait times count mismatch');
    }

    if (Math.abs(resA.jsonData.summary.avgWaitTimeMinutes - 17.5) <= 1.0) {
      console.log('✅ Hosp A avg wait time calculation verified (approx 17.5 mins)');
    } else {
      console.error(`❌ Hosp A avg wait time calculation mismatch: got ${resA.jsonData.summary.avgWaitTimeMinutes}`);
    }

    // Test B: Multi-tenant isolation check (Hospital B appointment should NOT appear in Hosp A report)
    const docBInAReport = resA.jsonData.doctorWise.find(d => d.doctorId === docB.id);
    if (!docBInAReport) {
      console.log('✅ Multi-tenant isolation verified: Dr. Wait B from Hospital B is NOT present in Hospital A report');
    } else {
      console.error('❌ Multi-tenant isolation breach! Hosp B doctor found in Hosp A report.');
    }

    // Cleanup test records
    await appt1.destroy();
    await appt2.destroy();
    await appt3.destroy();
    console.log('\nCleaned up test appointments.');

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await sequelize.close();
  }
}

testWaitTimeAnalytics();
