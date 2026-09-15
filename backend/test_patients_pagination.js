const http = require('http');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_in_production';

const tokenAdminA = jwt.sign(
  { id: '18e38e4d-6a90-4ed8-9099-59055b6e4b9b', role: 'admin', hospitalId: 'b7be674a-6839-4c51-a005-9608952bbb8b' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

function makeReq(endpoint) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 5010,
      path: endpoint,
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenAdminA}` }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch(e) { parsed = data; }
        resolve({ status: res.statusCode, data: parsed });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  const p1 = await makeReq('/api/patients?page=1&limit=2');
  const p2 = await makeReq('/api/patients?page=2&limit=2');

  console.log('=== RAW JSON RESPONSE: GET /api/patients?page=1&limit=2 ===');
  console.log(JSON.stringify(p1.data, null, 2));

  console.log('\n=== RAW JSON RESPONSE: GET /api/patients?page=2&limit=2 ===');
  console.log(JSON.stringify(p2.data, null, 2));

  process.exit(0);
}

run().catch(console.error);
