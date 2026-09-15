require('dotenv').config();
const http = require('http');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_in_production';

const tokenHospitalA = jwt.sign(
  { id: '18e38e4d-6a90-4ed8-9099-59055b6e4b9b', role: 'admin', hospitalId: 'b7be674a-6839-4c51-a005-9608952bbb8b', email: 'admin_hospital_a@test.com' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const tokenHospitalB = jwt.sign(
  { id: '2c49fff8-a1b4-4eeb-8b81-b494cfe72473', role: 'admin', hospitalId: '10985697-f62b-485d-9b3f-3460410c8bd7', email: 'admin_hospital_b@test.com' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const tokenPatient = jwt.sign(
  { id: '6db12648-ab91-4cf9-a366-b56452b8c300', role: 'patient', hospitalId: 'b7be674a-6839-4c51-a005-9608952bbb8b', email: 'patient_hospital_a@test.com' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

function makeRequest(path, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 5010,
      path: path,
      method: 'GET',
      headers: {}
    };
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch(e) { parsed = data; }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsed
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runVerification() {
  console.log('====================================================');
  console.log('TEST 1: PAGINATION VERIFICATION (?page=3 vs ?page=4)');
  console.log('====================================================');

  // 1A: Page 3 Cold
  const t0_p3 = performance.now();
  const res_p3_cold = await makeRequest('/api/appointments?page=3&limit=25', tokenHospitalA);
  const t1_p3 = performance.now();
  console.log('\n--- 1A: GET /api/appointments?page=3&limit=25 (COLD) ---');
  console.log(`HTTP Status: ${res_p3_cold.status}`);
  console.log(`Latency: ${(t1_p3 - t0_p3).toFixed(2)} ms`);
  console.log(`X-Cache Header: ${res_p3_cold.headers['x-cache'] || 'NONE'}`);
  console.log('Page 3 Raw Response snippet:');
  console.log(JSON.stringify({
    meta: res_p3_cold.data?.meta,
    firstRecord: res_p3_cold.data?.data?.[0]
  }, null, 2));

  // 1B: Page 3 Warm
  const t0_p3_warm = performance.now();
  const res_p3_warm = await makeRequest('/api/appointments?page=3&limit=25', tokenHospitalA);
  const t1_p3_warm = performance.now();
  console.log('\n--- 1B: GET /api/appointments?page=3&limit=25 (WARM) ---');
  console.log(`HTTP Status: ${res_p3_warm.status}`);
  console.log(`Latency: ${(t1_p3_warm - t0_p3_warm).toFixed(2)} ms`);
  console.log(`X-Cache Header: ${res_p3_warm.headers['x-cache'] || 'NONE'}`);

  // 1C: Page 4 Cold
  const t0_p4 = performance.now();
  const res_p4_cold = await makeRequest('/api/appointments?page=4&limit=25', tokenHospitalA);
  const t1_p4 = performance.now();
  console.log('\n--- 1C: GET /api/appointments?page=4&limit=25 (PAGE 4 COLD) ---');
  console.log(`HTTP Status: ${res_p4_cold.status}`);
  console.log(`Latency: ${(t1_p4 - t0_p4).toFixed(2)} ms`);
  console.log(`X-Cache Header: ${res_p4_cold.headers['x-cache'] || 'NONE'}`);
  console.log('Page 4 Raw Response snippet:');
  console.log(JSON.stringify({
    meta: res_p4_cold.data?.meta,
    firstRecord: res_p4_cold.data?.data?.[0]
  }, null, 2));

  const firstRecordP3Id = res_p3_cold.data?.data?.[0]?.id;
  const firstRecordP4Id = res_p4_cold.data?.data?.[0]?.id;
  console.log(`\nPage 3 First Record ID: ${firstRecordP3Id}`);
  console.log(`Page 4 First Record ID: ${firstRecordP4Id}`);
  console.log(`Pagination Check: ${firstRecordP3Id !== firstRecordP4Id ? 'PASS - Page 3 and Page 4 return distinct records!' : 'FAIL - Page 3 and Page 4 return identical records!'}`);


  console.log('\n====================================================');
  console.log('TEST 2: AUTHENTICATION & AUTHORIZATION BYPASS TEST');
  console.log('====================================================');

  const res_unauth = await makeRequest('/api/appointments?page=1&limit=25', null);
  console.log('\n--- 2A: Unauthenticated Request (No Token) ---');
  console.log(`HTTP Status: ${res_unauth.status}`);
  console.log(`X-Cache Header: ${res_unauth.headers['x-cache'] || 'NONE (BLOCKED BY AUTH FIRST)'}`);
  console.log(`Response Body: ${JSON.stringify(res_unauth.data)}`);

  const res_forbidden = await makeRequest('/api/medications/expiry-alerts', tokenPatient);
  console.log('\n--- 2B: Unauthorized Role Request (Patient requesting medication expiry-alerts) ---');
  console.log(`HTTP Status: ${res_forbidden.status}`);
  console.log(`X-Cache Header: ${res_forbidden.headers['x-cache'] || 'NONE (BLOCKED BY AUTHORIZE FIRST)'}`);
  console.log(`Response Body: ${JSON.stringify(res_forbidden.data)}`);


  console.log('\n====================================================');
  console.log('TEST 3: MULTI-TENANT ISOLATION TEST (CLEAN COLD START)');
  console.log('====================================================');

  // Step 1: Hospital A (Cold)
  const res_step1 = await makeRequest('/api/doctors', tokenHospitalA);
  console.log('\n--- STEP 1: GET /api/doctors (Hospital A - Cold) ---');
  console.log(`HTTP Status: ${res_step1.status}`);
  console.log(`X-Cache Header: ${res_step1.headers['x-cache'] || 'NONE'}`);
  console.log('Raw Response (Hospital A):');
  console.log(JSON.stringify(res_step1.data, null, 2));

  // Step 2: Hospital A (Warm)
  const res_step2 = await makeRequest('/api/doctors', tokenHospitalA);
  console.log('\n--- STEP 2: GET /api/doctors (Hospital A - Warm Repeat) ---');
  console.log(`HTTP Status: ${res_step2.status}`);
  console.log(`X-Cache Header: ${res_step2.headers['x-cache'] || 'NONE'}`);

  // Step 3: Hospital B (Cold)
  const res_step3 = await makeRequest('/api/doctors', tokenHospitalB);
  console.log('\n--- STEP 3: GET /api/doctors (Hospital B - Cold) ---');
  console.log(`HTTP Status: ${res_step3.status}`);
  console.log(`X-Cache Header: ${res_step3.headers['x-cache'] || 'NONE'}`);
  console.log('Raw Response (Hospital B):');
  console.log(JSON.stringify(res_step3.data, null, 2));

  // Step 4: Hospital B (Warm)
  const res_step4 = await makeRequest('/api/doctors', tokenHospitalB);
  console.log('\n--- STEP 4: GET /api/doctors (Hospital B - Warm Repeat) ---');
  console.log(`HTTP Status: ${res_step4.status}`);
  console.log(`X-Cache Header: ${res_step4.headers['x-cache'] || 'NONE'}`);

  const doctorsA = Array.isArray(res_step1.data) ? res_step1.data : [];
  const doctorsB = Array.isArray(res_step3.data) ? res_step3.data : [];
  const idsA = doctorsA.map(d => d.id);
  const idsB = doctorsB.map(d => d.id);

  console.log('\n=== SIDE-BY-SIDE COMPARISON ===');
  console.log(`Hospital A Doctor Count: ${doctorsA.length} | IDs: [${idsA.join(', ')}]`);
  console.log(`Hospital B Doctor Count: ${doctorsB.length} | IDs: [${idsB.join(', ')}]`);

  const hasOverlap = idsA.some(id => idsB.includes(id));
  const isBothNonEmpty = doctorsA.length > 0 && doctorsB.length > 0;

  if (isBothNonEmpty && !hasOverlap) {
    console.log('\nRESULT: PASS — Both hospitals return non-empty, completely distinct doctor sets.');
  } else {
    console.log(`\nRESULT: FAIL — ${!isBothNonEmpty ? 'One or both doctor lists are empty.' : 'Overlap detected between Hospital A and Hospital B!'}`);
  }
}

runVerification().catch(console.error);
