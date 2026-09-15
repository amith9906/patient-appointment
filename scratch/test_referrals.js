require('d:/Doc/backend/node_modules/dotenv').config({ path: 'd:/Doc/backend/.env' });
const { Referral, Patient, Doctor, Hospital, User } = require('d:/Doc/backend/src/models');
const referralController = require('d:/Doc/backend/src/controllers/referralController');

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return res;
}

async function testReferrals() {
  try {
    const user = await User.findOne();
    const hospital = await Hospital.findOne();
    const patient = await Patient.findOne({ where: { hospitalId: hospital.id } }) || await Patient.findOne();
    const receivingDoc = await Doctor.findOne({ where: { hospitalId: hospital.id } }) || await Doctor.findOne();

    if (!hospital || !patient || !receivingDoc) {
      console.error('Missing seed records for testing referrals');
      process.exit(1);
    }

    console.log('=== TEST 1: CREATE REFERRAL (EXTERNAL REFERRING DOCTOR) ===');
    const req1 = {
      user: { id: user ? user.id : hospital.id, hospitalId: hospital.id, role: 'admin' },
      body: {
        hospitalId: hospital.id,
        patientId: patient.id,
        receivingDoctorId: receivingDoc.id,
        referringDoctorName: 'Dr. Apex Specialist',
        referringDoctorClinic: 'Apex Heart Care Clinic',
        referringDoctorPhone: '9898989898',
        referralDate: '2026-09-14',
        reason: 'Second opinion for cardiac evaluation',
        notes: 'Patient carries previous ECG reports',
      },
    };
    const res1 = createMockRes();
    await referralController.create(req1, res1);

    console.log(`HTTP Status: ${res1.statusCode}`);
    console.log('Created Referral Response:');
    console.log(`- Referral ID: ${res1.body?.id}`);
    console.log(`- Patient Name: ${res1.body?.patient?.name}`);
    console.log(`- Referring Doctor Name (External): ${res1.body?.referringDoctorName} (${res1.body?.referringDoctorClinic})`);
    console.log(`- Receiving Doctor Name (Internal): ${res1.body?.receivingDoctor?.name}`);
    console.log(`- Status: ${res1.body?.status}`);

    if (res1.statusCode !== 201 || !res1.body?.id) {
      throw new Error('Referral creation failed');
    }
    const referralId = res1.body.id;

    console.log('\n=== TEST 2: UPDATE REFERRAL STATUS TO COMPLETED ===');
    const req2 = {
      user: { id: user ? user.id : hospital.id, hospitalId: hospital.id, role: 'admin' },
      params: { id: referralId },
      body: {
        status: 'completed',
        notes: 'Consultation completed by receiving specialist.',
      },
    };
    const res2 = createMockRes();
    await referralController.update(req2, res2);

    console.log(`HTTP Status: ${res2.statusCode}`);
    console.log(`Updated Referral Status: ${res2.body?.status}`);
    console.log(`Updated Notes: ${res2.body?.notes}`);

    if (res2.body?.status !== 'completed') {
      throw new Error(`Status update failed, expected completed, got ${res2.body?.status}`);
    }

    console.log('\n=== TEST 3: QUERY REFERRALS LIST (MULTI-TENANT SCOPED) ===');
    const req3 = {
      user: { id: user ? user.id : hospital.id, hospitalId: hospital.id, role: 'admin' },
      query: { status: 'completed' },
    };
    const res3 = createMockRes();
    await referralController.getAll(req3, res3);

    console.log(`HTTP Status: ${res3.statusCode}`);
    console.log(`Fetched Referrals Count: ${res3.body?.length || res3.body?.data?.length}`);

    // Cleanup test referral
    await Referral.destroy({ where: { id: referralId } });

    console.log('\n=== GAP 2 VERIFICATION COMPLETED SUCCESSFULLY ===');
    process.exit(0);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

testReferrals();
