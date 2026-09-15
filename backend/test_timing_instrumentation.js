const axios = require('axios');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secret-key-change-in-production';
const token = jwt.sign(
  { id: 'u1', role: 'admin', hospitalId: 'h1', email: 'admin@local.test' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

async function runTimingTest() {
  console.log('--- EXECUTING INSTRUMENTED GET /api/doctors ---');
  const t0 = performance.now();
  const res = await axios.get('http://localhost:5010/api/doctors', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const t1 = performance.now();
  console.log(`HTTP Client Measured Round-trip Latency: ${(t1 - t0).toFixed(2)}ms`);
}

runTimingTest().catch(console.error);
