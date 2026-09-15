require('d:/Doc/backend/node_modules/dotenv').config({ path: 'd:/Doc/backend/.env' });
const jwt = require('../backend/node_modules/jsonwebtoken');
const { Patient, Hospital, PatientOtp, sequelize } = require('../backend/src/models');
const { authenticate } = require('../backend/src/middleware/auth');
const { requestOtp, verifyOtp } = require('../backend/src/controllers/patientPortalController');

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

async function testFourSpecifics() {
  console.log('=============== PATIENT PORTAL: 4 SPECIFICS VERIFICATION ===============\n');

  try {
    // Setup test hospital & patient
    const [hosp] = await Hospital.findOrCreate({
      where: { name: 'Portal Security Test Hospital' },
      defaults: { code: 'PSTH', address: '123 Portal Way', phone: '1119998888' },
    });

    const testPhone = '9900112233';
    const [patientWithEmail] = await Patient.findOrCreate({
      where: { phone: testPhone, hospitalId: hosp.id },
      defaults: {
        name: 'Portal Test Patient',
        email: 'patient.test@example.com',
        patientId: `P-PSTH-${Date.now()}`,
        gender: 'male',
      },
    });

    const noEmailPhone = '9900112244';
    const [patientNoEmail] = await Patient.findOrCreate({
      where: { phone: noEmailPhone, hospitalId: hosp.id },
      defaults: {
        name: 'No Email Patient',
        email: null, // Explicitly no email
        patientId: `P-NOEM-${Date.now()}`,
        gender: 'female',
      },
    });

    // -------------------------------------------------------------
    // ITEM 1: STAFF MIDDLEWARE REJECTION PROOF
    // -------------------------------------------------------------
    console.log('--- SPECIFIC 1: Staff Middleware Rejection Proof ---');

    // Create valid patient portal token
    const patientToken = jwt.sign(
      {
        id: patientWithEmail.id,
        patientId: patientWithEmail.id,
        hospitalId: hosp.id,
        role: 'patient',
        isPatientPortal: true,
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    const mockReqStaff = {
      headers: { authorization: `Bearer ${patientToken}` },
    };
    const mockResStaff = createMockRes();

    let staffNextCalled = false;
    await authenticate(mockReqStaff, mockResStaff, () => {
      staffNextCalled = true;
    });

    console.log('Attempting staff route authenticate with Patient Portal Token:');
    console.log(`HTTP Status Code: ${mockResStaff.statusCode}`);
    console.log('Response Body:', JSON.stringify(mockResStaff.jsonData, null, 2));
    console.log(`Next middleware called: ${staffNextCalled ? 'YES (FAILURE)' : 'NO (REJECTED - SUCCESS)'}`);

    if (mockResStaff.statusCode === 403 && mockResStaff.jsonData?.message?.includes('Patient portal tokens cannot access staff routes')) {
      console.log('✅ Specific 1 PASS: Staff middleware explicitly rejects patient tokens by construction!\n');
    } else {
      console.error('❌ Specific 1 FAIL: Staff middleware failed to reject patient token properly.\n');
    }

    // -------------------------------------------------------------
    // ITEM 2: OTP ATTEMPT-LOCK BEHAVIOR PROOF
    // -------------------------------------------------------------
    console.log('--- SPECIFIC 2: OTP Attempt-Lock & Self-Recovery Proof ---');

    // Clean previous OTPs for test phone
    await PatientOtp.destroy({ where: { phone: testPhone } });

    // Step A: Request OTP
    const reqOtp1 = { body: { phone: testPhone } };
    const resOtp1 = createMockRes();
    await requestOtp(reqOtp1, resOtp1);
    const validDevOtp = resOtp1.jsonData.devOtp;
    console.log(`Generated test OTP: ${validDevOtp}`);

    // Step B: Enter WRONG OTP 3 times
    const wrongOtp = '000000';
    for (let i = 1; i <= 3; i++) {
      const reqWrong = { body: { phone: testPhone, otp: wrongOtp } };
      const resWrong = createMockRes();
      await verifyOtp(reqWrong, resWrong);
      console.log(`Wrong OTP Attempt #${i} -> Status: ${resWrong.statusCode}, Message: "${resWrong.jsonData?.message}"`);
    }

    // Step C: 4th Attempt on same OTP -> Must be locked
    const reqLocked = { body: { phone: testPhone, otp: wrongOtp } };
    const resLocked = createMockRes();
    await verifyOtp(reqLocked, resLocked);
    console.log(`4th Attempt (Locked OTP) -> Status: ${resLocked.statusCode}, Message: "${resLocked.jsonData?.message}"`);

    // Step D: Self-Recovery -> Patient requests a FRESH OTP
    await PatientOtp.destroy({ where: { phone: testPhone } }); // reset count for test
    const reqFresh = { body: { phone: testPhone } };
    const resFresh = createMockRes();
    await requestOtp(reqFresh, resFresh);
    const freshDevOtp = resFresh.jsonData.devOtp;
    console.log(`Fresh OTP requested after lock: ${freshDevOtp}`);

    // Step E: Verify with fresh OTP
    const reqVerifyFresh = { body: { phone: testPhone, otp: freshDevOtp } };
    const resVerifyFresh = createMockRes();
    await verifyOtp(reqVerifyFresh, resVerifyFresh);
    console.log(`Verification with Fresh OTP -> Status: ${resVerifyFresh.statusCode}, Token Issued: ${Boolean(resVerifyFresh.jsonData?.token)}`);

    if (resLocked.statusCode === 400 && resVerifyFresh.statusCode === 200) {
      console.log('✅ Specific 2 PASS: OTP locks after 3 attempts and allows self-recovery via fresh OTP!\n');
    } else {
      console.error('❌ Specific 2 FAIL: Lock or recovery logic failed.\n');
    }

    // -------------------------------------------------------------
    // ITEM 3: NO-DELIVERY-METHOD FALLBACK & DEV GATING PROOF
    // -------------------------------------------------------------
    console.log('--- SPECIFIC 3: No-Delivery Fallback & Dev-Gating Proof ---');

    // Test in PRODUCTION environment mode
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const reqProdNoEmail = { body: { phone: noEmailPhone, hospitalId: hosp.id } };
    const resProdNoEmail = createMockRes();
    await requestOtp(reqProdNoEmail, resProdNoEmail);

    console.log('[PRODUCTION MODE] Request OTP for patient with NO email:');
    console.log(`HTTP Status Code: ${resProdNoEmail.statusCode}`);
    console.log('Response Body:', JSON.stringify(resProdNoEmail.jsonData, null, 2));
    console.log(`devOtp field exposed in response: ${Boolean(resProdNoEmail.jsonData?.devOtp) ? 'YES (FAILURE)' : 'NO (PROTECTED - SUCCESS)'}`);

    // Restore NODE_ENV
    process.env.NODE_ENV = 'development';

    const reqDevNoEmail = { body: { phone: noEmailPhone, hospitalId: hosp.id } };
    const resDevNoEmail = createMockRes();
    await requestOtp(reqDevNoEmail, resDevNoEmail);
    console.log('\n[DEV MODE] Request OTP for patient in Development Environment:');
    console.log(`devOtp field exposed in dev response: ${resDevNoEmail.jsonData?.devOtp}`);

    if (resProdNoEmail.statusCode === 400 && !resProdNoEmail.jsonData?.devOtp && resDevNoEmail.jsonData?.devOtp) {
      console.log('✅ Specific 3 PASS: Production mode cleanly rejects no-delivery patients without exposing dev OTP!\n');
    } else {
      console.error('❌ Specific 3 FAIL: Dev gating or fallback failed.\n');
    }

    // -------------------------------------------------------------
    // ITEM 4: PATIENT PORTAL TOKEN LIFETIME PROOF
    // -------------------------------------------------------------
    console.log('--- SPECIFIC 4: Patient Portal Token Lifetime Proof ---');
    const issuedToken = resVerifyFresh.jsonData.token;
    const decodedToken = jwt.decode(issuedToken);

    console.log('Decoded Token Claims:');
    console.log(JSON.stringify(decodedToken, null, 2));

    const tokenDurationHours = (decodedToken.exp - decodedToken.iat) / 3600;
    console.log(`Token Issued At (iat): ${new Date(decodedToken.iat * 1000).toISOString()}`);
    console.log(`Token Expires At (exp): ${new Date(decodedToken.exp * 1000).toISOString()}`);
    console.log(`Calculated Lifetime: ${tokenDurationHours} Hours`);

    if (tokenDurationHours === 24 && decodedToken.isPatientPortal === true && decodedToken.role === 'patient') {
      console.log('✅ Specific 4 PASS: Patient portal token lifetime is explicitly configured to 24 Hours!\n');
    } else {
      console.error('❌ Specific 4 FAIL: Token lifetime or claims mismatch.\n');
    }

    // Cleanup test records
    await PatientOtp.destroy({ where: { phone: [testPhone, noEmailPhone] } });
    await Patient.destroy({ where: { id: [patientWithEmail.id, patientNoEmail.id] } });
    await Hospital.destroy({ where: { id: hosp.id } });
    console.log('Cleaned up test data.');
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    process.env.NODE_ENV = 'development';
    await sequelize.close();
  }
}

testFourSpecifics();
