const http = require('http');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_in_production';

const tokenAdminA = jwt.sign(
  { id: '18e38e4d-6a90-4ed8-9099-59055b6e4b9b', role: 'admin', hospitalId: 'b7be674a-6839-4c51-a005-9608952bbb8b' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

function makeReq(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 5010,
      path: path,
      method: method,
      headers: {
        Authorization: `Bearer ${tokenAdminA}`,
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch(e) { parsed = data; }
        resolve({ status: res.statusCode, data: parsed });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  const apptId = '3f8630db-e541-45f9-a87b-37d9342ab300';

  console.log('--- 1. VIEW A (TAB 1): READ VITALS INITIAL STATE ---');
  const view1_before = await makeReq('GET', `/api/appointments/${apptId}/vitals`);
  console.log('Tab 1 Initial Object:', JSON.stringify(view1_before.data, null, 2));

  console.log('\n--- 2. VIEW B (TAB 2): MUTATE / SAVE NEW VITALS ---');
  const newPulse = Math.floor(70 + Math.random() * 20);
  const saveRes = await makeReq('PUT', `/api/appointments/${apptId}/vitals`, {
    pulse: newPulse,
    bp_systolic: 120,
    bp_diastolic: 80,
    temp: 98.6,
    spO2: 99
  });
  console.log(`Tab 2 Saved Object:`, JSON.stringify(saveRes.data, null, 2));

  console.log('\n--- 3. VIEW A (TAB 1): RE-FETCH / AUTO-POLL (REFETCH INTERVAL / INVALIDATION) ---');
  const view1_after = await makeReq('GET', `/api/appointments/${apptId}/vitals`);
  console.log('Tab 1 Refreshed Object:', JSON.stringify(view1_after.data, null, 2));

  const updatedPulse = Number(view1_after.data?.pulse);
  console.log(`\nMulti-View Data Synchronization Check: ${updatedPulse === newPulse ? 'PASS - Tab 1 immediately reflects Tab 2 write!' : 'FAIL - Stale data detected!'}`);
  process.exit(0);
}

run().catch(console.error);
