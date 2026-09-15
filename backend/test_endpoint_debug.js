const http = require('http');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_in_production';

const tokenAdminA = jwt.sign(
  { id: '18e38e4d-6a90-4ed8-9099-59055b6e4b9b', role: 'admin', hospitalId: 'b7be674a-6839-4c51-a005-9608952bbb8b' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

function getAppointments(page) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 5010,
      path: `/api/appointments?page=${page}&limit=25`,
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenAdminA}` }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`PAGE ${page} STATUS:`, res.statusCode, 'X-CACHE:', res.headers['x-cache']);
        console.log('BODY snippet:', data.slice(0, 300));
        resolve({ status: res.statusCode, body: data });
      });
    });
    req.end();
  });
}

async function test() {
  await getAppointments(1);
  await getAppointments(1);
  await getAppointments(2);
  process.exit(0);
}

test();
