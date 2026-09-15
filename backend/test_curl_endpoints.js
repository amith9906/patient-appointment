const http = require('http');

const PORT = process.env.PORT || 5010;

function request(options, bodyData) {
  return new Promise((resolve, reject) => {
    const start = process.hrtime.bigint();
    const req = http.request(options, (res) => {
      let data = [];
      res.on('data', (chunk) => data.push(chunk));
      res.on('end', () => {
        const end = process.hrtime.bigint();
        const durationMs = Number(end - start) / 1e6;
        const buf = Buffer.concat(data);
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          durationMs: durationMs.toFixed(2),
          bodyText: buf.toString('utf-8'),
        });
      });
    });
    req.on('error', reject);
    if (bodyData) req.write(bodyData);
    req.end();
  });
}

async function run() {
  // Login first
  const loginBody = JSON.stringify({ email: 'admin@local.test', password: 'Admin@123' });
  const loginRes = await request({
    hostname: 'localhost',
    port: PORT,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(loginBody),
    },
  }, loginBody);

  const loginObj = JSON.parse(loginRes.bodyText);
  const token = loginObj.token || loginObj.data?.token;

  const endpoints = [
    '/api/appointments?page=1&limit=25',
    '/api/doctors',
    '/api/medications/expiry-alerts',
  ];

  for (const ep of endpoints) {
    console.log(`\n========================================`);
    console.log(`ENDPOINT: GET ${ep}`);
    console.log(`========================================`);

    const options = {
      hostname: 'localhost',
      port: PORT,
      path: ep,
      method: 'GET',
      headers: {
        'Accept-Encoding': 'gzip, deflate',
        'Authorization': `Bearer ${token}`,
      },
    };

    // Run 1: Cold Request
    const res1 = await request(options);
    console.log(`\n--- RUN 1 (COLD) --- [Latency: ${res1.durationMs} ms]`);
    console.log(`HTTP ${res1.statusCode}`);
    console.log(JSON.stringify(res1.headers, null, 2));

    // Run 2: Warm / Cached Request
    const res2 = await request(options);
    console.log(`\n--- RUN 2 (WARM / CACHED) --- [Latency: ${res2.durationMs} ms]`);
    console.log(`HTTP ${res2.statusCode}`);
    console.log(JSON.stringify(res2.headers, null, 2));
  }

  process.exit(0);
}

run();
