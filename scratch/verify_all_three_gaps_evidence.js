require('d:/Doc/backend/node_modules/dotenv').config({ path: 'd:/Doc/backend/.env' });
const { Appointment, Doctor, Patient, Hospital, Referral, sequelize } = require('../backend/src/models');
const { getDoctorBySlug, submitPublicBooking } = require('../backend/src/controllers/publicDoctorController');
const { getWaitTimeAnalytics } = require('../backend/src/controllers/reportController');
const { create, update, getAll } = require('../backend/src/controllers/referralController');

function createMockRes() {
  const res = {
    statusCode: 200,
    jsonData: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    },
  };
  return res;
}

async function runVerification() {
  console.log('=============== REAL EVIDENCE GENERATION SCRIPT ===============\n');

  try {
    // -------------------------------------------------------------
    // SETUP: Create isolated test hospitals & doctors
    // -------------------------------------------------------------
    const [hospA] = await Hospital.findOrCreate({
      where: { name: 'Evidence Hospital A' },
      defaults: { code: 'EHA', address: '100 Alpha St', phone: '1111111111' },
    });
    const [hospB] = await Hospital.findOrCreate({
      where: { name: 'Evidence Hospital B' },
      defaults: { code: 'EHB', address: '200 Beta St', phone: '2222222222' },
    });

    const [docA] = await Doctor.findOrCreate({
      where: { name: 'Dr. Public Alpha', hospitalId: hospA.id },
      defaults: {
        slug: 'dr-public-alpha-eha1',
        specialization: 'General Medicine',
        consultationFee: 750,
        phone: '9991112223',
      },
    });

    const [docB] = await Doctor.findOrCreate({
      where: { name: 'Dr. Public Beta', hospitalId: hospB.id },
      defaults: {
        slug: 'dr-public-beta-ehb2',
        specialization: 'Orthopedics',
        consultationFee: 900,
        phone: '9994445556',
      },
    });

    // -------------------------------------------------------------
    // ITEM 1: DOCTOR QR BOOKING PAGES EVIDENCE
    // -------------------------------------------------------------
    console.log('--- ITEM 1: Doctor QR Booking Pages Evidence ---');

    // 1.1 Hit GET /api/public/doctors/:slug unauthenticated (no req.user)
    const reqGetSlug = {
      params: { slug: docA.slug },
      user: undefined, // Explicitly no auth header / unauthenticated
    };
    const resGetSlug = createMockRes();
    await getDoctorBySlug(reqGetSlug, resGetSlug);

    console.log('\n[RAW RESPONSE] GET /api/public/doctors/:slug (Unauthenticated):');
    console.log(JSON.stringify(resGetSlug.jsonData, null, 2));

    // 1.2 Hit POST /api/public/doctors/:slug/book
    const reqBook = {
      params: { slug: docA.slug },
      user: undefined, // Explicitly unauthenticated
      body: {
        patientName: 'Jane Doe Evidence',
        patientPhone: '9876500001',
        patientEmail: 'jane.doe@example.com',
        appointmentDate: '2026-09-20',
        appointmentTime: '11:30 AM',
        reason: 'General health checkup request',
      },
    };
    const resBook = createMockRes();
    await submitPublicBooking(reqBook, resBook);

    console.log('\n[RAW RESPONSE] POST /api/public/doctors/:slug/book:');
    console.log(JSON.stringify(resBook.jsonData, null, 2));

    const createdApptId = resBook.jsonData.appointment.id;

    // 1.3 Direct DB query showing created appointment row
    const [rawApptRow] = await sequelize.query(
      `SELECT id, "appointmentNumber", "doctorId", "patientId", "appointmentDate", "appointmentTime", status, type, fee, reason FROM "Appointments" WHERE id = :id;`,
      { replacements: { id: createdApptId } }
    );

    console.log('\n[RAW DB QUERY] SELECT * FROM "Appointments" WHERE id = createdApptId:');
    console.log(JSON.stringify(rawApptRow, null, 2));

    // -------------------------------------------------------------
    // ITEM 2: REFERRAL MANAGEMENT EVIDENCE
    // -------------------------------------------------------------
    console.log('\n--- ITEM 2: Referral Management Evidence ---');

    const [patientA] = await Patient.findOrCreate({
      where: { name: 'Referral Patient Evidence', hospitalId: hospA.id },
      defaults: { patientId: `P-EHA-${Date.now()}`, gender: 'female', phone: '9876500002' },
    });

    // 2.1 Create referral with external doctor (Dr. Sarah Jenkins) - referringDoctorId is NULL
    const reqCreateRef = {
      user: { role: 'admin', hospitalId: hospA.id },
      body: {
        patientId: patientA.id,
        referringDoctorName: 'Dr. Sarah Jenkins',
        referringDoctorClinic: 'City Heart Clinic',
        referringDoctorPhone: '9887766554',
        receivingDoctorId: docA.id,
        reason: 'Cardiac evaluation referral',
        notes: 'External doctor referral',
      },
    };
    const resCreateRef = createMockRes();
    await create(reqCreateRef, resCreateRef);

    const refId = resCreateRef.jsonData.id;

    // 2.2 Direct DB query: Raw row right after creation
    const [rawRefCreatedRow] = await sequelize.query(
      `SELECT id, "hospitalId", "patientId", "referringDoctorId", "referringDoctorName", "referringDoctorClinic", "referringDoctorPhone", "receivingDoctorId", status, reason FROM "Referrals" WHERE id = :id;`,
      { replacements: { id: refId } }
    );

    console.log('\n[RAW DB QUERY] SELECT * FROM "Referrals" WHERE id = refId (Newly Created):');
    console.log(JSON.stringify(rawRefCreatedRow, null, 2));

    // 2.3 Update status to 'completed'
    const reqUpdateRef = {
      user: { role: 'admin', hospitalId: hospA.id },
      params: { id: refId },
      body: { status: 'completed', notes: 'Consultation completed by Dr. Public Alpha' },
    };
    const resUpdateRef = createMockRes();
    await update(reqUpdateRef, resUpdateRef);

    // Direct DB query: Raw row after status updated to completed
    const [rawRefCompletedRow] = await sequelize.query(
      `SELECT id, "hospitalId", status, notes, "updatedAt" FROM "Referrals" WHERE id = :id;`,
      { replacements: { id: refId } }
    );

    console.log('\n[RAW DB QUERY] SELECT * FROM "Referrals" WHERE id = refId (Status Updated to Completed):');
    console.log(JSON.stringify(rawRefCompletedRow, null, 2));

    // 2.4 Multi-tenant isolation test query (Hospital A vs Hospital B)
    // Create a referral in Hospital B
    const [patientB] = await Patient.findOrCreate({
      where: { name: 'Hosp B Patient', hospitalId: hospB.id },
      defaults: { patientId: `P-EHB-${Date.now()}`, gender: 'male', phone: '9876500003' },
    });
    const [refB] = await Referral.findOrCreate({
      where: { patientId: patientB.id, hospitalId: hospB.id },
      defaults: {
        referringDoctorName: 'Dr. External B',
        receivingDoctorId: docB.id,
        reason: 'Hosp B internal referral',
      },
    });

    const reqGetAllRefA = {
      user: { role: 'admin', hospitalId: hospA.id },
      query: {},
    };
    const resGetAllRefA = createMockRes();
    await getAll(reqGetAllRefA, resGetAllRefA);

    console.log('\n[RAW RESPONSE] GET /api/referrals (Authenticated as Hospital A Admin):');
    console.log(`Total referrals returned for Hospital A: ${resGetAllRefA.jsonData.length || resGetAllRefA.jsonData.data?.length || 0}`);
    const containsHospBRef = (resGetAllRefA.jsonData.data || resGetAllRefA.jsonData).some(r => r.hospitalId === hospB.id);
    console.log(`Contains Hospital B Referral (${refB.id}): ${containsHospBRef ? 'YES (FAILURE)' : 'NO (ISOLATED - SUCCESS)'}`);

    // -------------------------------------------------------------
    // ITEM 3: WAIT-TIME ANALYTICS EVIDENCE
    // -------------------------------------------------------------
    console.log('\n--- ITEM 3: Wait-Time Analytics Evidence ---');

    const todayStr = new Date().toISOString().split('T')[0];
    const baseTime = new Date();

    // Create 3 test appointments with VARIED, non-symmetrical, and NULL timestamps:
    // Appt 1: Checked in 40m ago, started 28m ago, completed 10m ago
    // -> Wait time = 12 mins, Consultation duration = 18 mins
    const apptW1 = await Appointment.create({
      appointmentNumber: `APPT-W-1-${Date.now()}`,
      doctorId: docA.id,
      patientId: patientA.id,
      appointmentDate: todayStr,
      appointmentTime: '09:00',
      status: 'completed',
      checkedInAt: new Date(baseTime.getTime() - 40 * 60 * 1000),
      consultationStartedAt: new Date(baseTime.getTime() - 28 * 60 * 1000),
      completedAt: new Date(baseTime.getTime() - 10 * 60 * 1000),
    });

    // Appt 2: Checked in 50m ago, started 25m ago, completed 11m ago
    // -> Wait time = 25 mins, Consultation duration = 14 mins
    const apptW2 = await Appointment.create({
      appointmentNumber: `APPT-W-2-${Date.now()}`,
      doctorId: docA.id,
      patientId: patientA.id,
      appointmentDate: todayStr,
      appointmentTime: '09:30',
      status: 'completed',
      checkedInAt: new Date(baseTime.getTime() - 50 * 60 * 1000),
      consultationStartedAt: new Date(baseTime.getTime() - 25 * 60 * 1000),
      completedAt: new Date(baseTime.getTime() - 11 * 60 * 1000),
    });

    // Appt 3: NULL timestamps (e.g. legacy or incomplete appointment)
    // -> Wait time = NULL, Consultation duration = NULL
    const apptW3 = await Appointment.create({
      appointmentNumber: `APPT-W-3-${Date.now()}`,
      doctorId: docA.id,
      patientId: patientA.id,
      appointmentDate: todayStr,
      appointmentTime: '10:00',
      status: 'scheduled',
      checkedInAt: null,
      consultationStartedAt: null,
      completedAt: null,
    });

    // Direct DB query showing exact raw timestamp values
    const [rawTimestamps] = await sequelize.query(
      `SELECT id, "appointmentNumber", status, "checkedInAt", "consultationStartedAt", "completedAt" FROM "Appointments" WHERE id IN (:ids);`,
      { replacements: { ids: [apptW1.id, apptW2.id, apptW3.id] } }
    );

    console.log('\n[RAW DB QUERY] Raw Timestamp Values for Test Appointments:');
    console.log(JSON.stringify(rawTimestamps, null, 2));

    // Call getWaitTimeAnalytics as Hospital A Admin
    const reqWait = {
      user: { role: 'admin', hospitalId: hospA.id },
      query: { from: todayStr, to: todayStr },
    };
    const resWait = createMockRes();
    await getWaitTimeAnalytics(reqWait, resWait);

    console.log('\n[RAW RESPONSE] GET /api/reports/wait-times (Hospital A Admin):');
    console.log(JSON.stringify(resWait.jsonData, null, 2));

    // Cleanup test records
    await Appointment.destroy({ where: { id: [createdApptId, apptW1.id, apptW2.id, apptW3.id] } });
    await Referral.destroy({ where: { id: [refId, refB.id] } });

    console.log('\nCleaned up test data successfully.');
  } catch (err) {
    console.error('ERROR in verification script:', err);
  } finally {
    await sequelize.close();
  }
}

runVerification();
