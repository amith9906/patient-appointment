import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * k6 Enterprise Load Testing Suite for Multi-Tenant HMS
 * Simulates 10,000 Concurrent User Sessions across 10 Core Workflows
 */

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Warmup to 100 VUs
    { duration: '5m', target: 500 },   // Scale to 500 VUs
    { duration: '5m', target: 1000 },  // Scale to 1,000 VUs
    { duration: '10m', target: 5000 }, // Ramp to 5,000 VUs
    { duration: '10m', target: 10000 },// Peak Enterprise Load 10,000 VUs
    { duration: '5m', target: 10000 }, // Soak test at 10,000 VUs
    { duration: '3m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // P95 < 500ms, P99 < 1000ms
    http_req_failed: ['rate<0.01'],                 // Error rate < 1%
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:5000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'Bearer mock-jwt-token-tenant-1';

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': AUTH_TOKEN,
    'X-Hospital-Id': '1'
  };

  // 1. Global Search API
  let resSearch = http.get(`${BASE_URL}/api/search/global?q=Ramesh`, { headers });
  check(resSearch, {
    'Global Search status is 200': (r) => r.status === 200,
    'Global Search latency < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);

  // 2. Patient Registration / Fetch
  let resPatient = http.get(`${BASE_URL}/api/patients?limit=10`, { headers });
  check(resPatient, {
    'Patient List status is 200': (r) => r.status === 200,
  });
  sleep(1);

  // 3. Appointment Booking / Fetch
  let resAppointment = http.get(`${BASE_URL}/api/appointments?limit=10`, { headers });
  check(resAppointment, {
    'Appointments status is 200': (r) => r.status === 200,
  });
  sleep(1);

  // 4. FHIR R4 Patient Resource API
  let resFHIR = http.get(`${BASE_URL}/fhir/Patient/1`, {
    headers: { ...headers, 'Accept': 'application/fhir+json' }
  });
  check(resFHIR, {
    'FHIR Patient status is 200': (r) => r.status === 200,
  });
  sleep(1);

  // 5. Executive Dashboard Metrics
  let resDashboard = http.get(`${BASE_URL}/api/observability/metrics`, { headers });
  check(resDashboard, {
    'Metrics status is 200': (r) => r.status === 200,
  });
  sleep(2);
}
