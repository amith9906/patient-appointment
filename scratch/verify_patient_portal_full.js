require('d:/Doc/backend/node_modules/dotenv').config({ path: 'd:/Doc/backend/.env' });
const jwt = require('../backend/node_modules/jsonwebtoken');
const { Patient, Hospital, Appointment, Prescription, Medication, MedicineCatalog, Report, MedicineInvoice, PatientOtp, sequelize } = require('../backend/src/models');
const { requestOtp, verifyOtp, getMe, getAppointments, getPrescriptions, getReports, getInvoices } = require('../backend/src/controllers/patientPortalController');
const { authenticate } = require('../backend/src/middleware/auth');

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

async function runFullVerification() {
  console.log('=============== FULL PATIENT PORTAL VERIFICATION SCRIPT ===============\n');

  try {
    // 1. Setup Test Hospital & Patients
    const [hospA] = await Hospital.findOrCreate({
      where: { name: 'Patient Portal Test Hospital A' },
      defaults: { code: 'PPHA', address: '123 Health Ave', phone: '1112223333' },
    });

    const [hospB] = await Hospital.findOrCreate({
      where: { name: 'Patient Portal Test Hospital B' },
      defaults: { code: 'PPHB', address: '456 Medical Way', phone: '4445556666' },
    });

    const phoneA = '9887766111';
    const [patientA] = await Patient.findOrCreate({
      where: { phone: phoneA, hospitalId: hospA.id },
      defaults: {
        name: 'Alice Portal Patient',
        email: 'alice.portal@example.com',
        patientId: `P-PPHA-${Date.now()}`,
        gender: 'female',
      },
    });

    const phoneB = '9887766222';
    const [patientB] = await Patient.findOrCreate({
      where: { phone: phoneB, hospitalId: hospB.id },
      defaults: {
        name: 'Bob Portal Patient',
        email: 'bob.portal@example.com',
        patientId: `P-PPHB-${Date.now()}`,
        gender: 'male',
      },
    });

    // Create test appointment for Patient A
    const apptA = await Appointment.create({
      appointmentNumber: `APT-PA-${Date.now()}`,
      doctorId: '1b2b4958-bde5-4639-b695-5a3b5dda9a6a', // fallback/test doc ID
      patientId: patientA.id,
      appointmentDate: '2026-09-25',
      appointmentTime: '10:00:00',
      status: 'scheduled',
      type: 'consultation',
      reason: 'Routine checkup',
    });

    // Create test appointment for Patient B
    const apptB = await Appointment.create({
      appointmentNumber: `APT-PB-${Date.now()}`,
      doctorId: '1b2b4958-bde5-4639-b695-5a3b5dda9a6a',
      patientId: patientB.id,
      appointmentDate: '2026-09-26',
      appointmentTime: '11:00:00',
      status: 'scheduled',
      type: 'consultation',
      reason: 'Cardiac follow up',
    });

    // 2. Request OTP & Verify OTP for Patient A
    await PatientOtp.destroy({ where: { phone: phoneA } });
    const reqOtpA = { body: { phone: phoneA } };
    const resOtpA = createMockRes();
    await requestOtp(reqOtpA, resOtpA);

    const devOtpA = resOtpA.jsonData.devOtp;
    console.log(`[AUTH] Requested OTP for Patient A (${phoneA}): Dev OTP = ${devOtpA}`);

    const reqVerifyA = { body: { phone: phoneA, otp: devOtpA } };
    const resVerifyA = createMockRes();
    await verifyOtp(reqVerifyA, resVerifyA);

    const tokenA = resVerifyA.jsonData.token;
    console.log(`[AUTH] Verified OTP. Patient A Token Issued (Lifetime: ${resVerifyA.jsonData.expiresIn})`);

    // 3. LIVE TEST 1: Patient-Scoped Endpoints
    console.log('\n--- LIVE TEST 1: Fetching Patient A Records via Patient Portal Token ---');

    const patientUserA = {
      id: patientA.id,
      patientId: patientA.id,
      hospitalId: hospA.id,
      role: 'patient',
      isPatientPortal: true,
    };

    // GET /api/patient-portal/me
    const reqMe = { user: patientUserA };
    const resMe = createMockRes();
    await getMe(reqMe, resMe);
    console.log('[GET /api/patient-portal/me]:', resMe.jsonData.name, `(${resMe.jsonData.patientId})`);

    // GET /api/patient-portal/appointments
    const reqAppts = { user: patientUserA };
    const resAppts = createMockRes();
    await getAppointments(reqAppts, resAppts);

    console.log(`[GET /api/patient-portal/appointments]: Returned ${resAppts.jsonData.length} appointment(s)`);
    const returnedApptIds = resAppts.jsonData.map((a) => a.id);
    const containsApptA = returnedApptIds.includes(apptA.id);
    const containsApptB = returnedApptIds.includes(apptB.id);

    console.log(`Contains Patient A Appointment (${apptA.id}): ${containsApptA ? 'YES' : 'NO'}`);
    console.log(`Contains Patient B Appointment (${apptB.id}): ${containsApptB ? 'YES (SECURITY FAILURE)' : 'NO (ISOLATED - SUCCESS)'}`);

    if (containsApptA && !containsApptB) {
      console.log('✅ Live Test 1 PASS: Endpoints strictly return only patient A data!');
    } else {
      console.error('❌ Live Test 1 FAIL: Data leakage detected.');
    }

    // 4. LIVE TEST 2: Role Isolation - Patient Token on Staff Route
    console.log('\n--- LIVE TEST 2: Patient Token Attempting Staff Endpoint ---');
    const reqStaffTest = {
      headers: { authorization: `Bearer ${tokenA}` },
    };
    const resStaffTest = createMockRes();

    let staffNextCalled = false;
    await authenticate(reqStaffTest, resStaffTest, () => {
      staffNextCalled = true;
    });

    console.log(`Staff authenticate middleware output -> Status: ${resStaffTest.statusCode}, Body:`, resStaffTest.jsonData);
    if (resStaffTest.statusCode === 403 && !staffNextCalled) {
      console.log('✅ Live Test 2 PASS: Patient token blocked from accessing staff routes by middleware guard!');
    } else {
      console.error('❌ Live Test 2 FAIL: Patient token allowed through staff middleware.');
    }

    // 5. LIVE TEST 3: ID Tampering Defense
    console.log('\n--- LIVE TEST 3: Attempted ID Tampering ---');
    // Attempt to pass query param patientId=patientB.id to patient portal route
    const reqTamper = {
      user: patientUserA,
      query: { patientId: patientB.id },
      params: { patientId: patientB.id },
      body: { patientId: patientB.id },
    };
    const resTamper = createMockRes();
    await getAppointments(reqTamper, resTamper);

    const tamperResultApptIds = resTamper.jsonData.map((a) => a.id);
    const tamperContainsB = tamperResultApptIds.includes(apptB.id);

    console.log(`Attempted to query with tampered param patientId=${patientB.id}`);
    console.log(`Result contains Patient B appointment: ${tamperContainsB ? 'YES (VULNERABLE)' : 'NO (PROTECTED - SUCCESS)'}`);

    if (!tamperContainsB) {
      console.log('✅ Live Test 3 PASS: Server ignores untrusted URL/body params and strictly uses req.user.patientId from token!');
    } else {
      console.error('❌ Live Test 3 FAIL: Server honored tampered parameter.');
    }

    // Cleanup test records
    await Appointment.destroy({ where: { id: [apptA.id, apptB.id] } });
    await PatientOtp.destroy({ where: { phone: [phoneA, phoneB] } });
    await Patient.destroy({ where: { id: [patientA.id, patientB.id] } });
    await Hospital.destroy({ where: { id: [hospA.id, hospB.id] } });

    console.log('\nCleaned up all test records.');
  } catch (err) {
    console.error('Test Error:', err);
  } finally {
    await sequelize.close();
  }
}

runFullVerification();
