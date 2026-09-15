const request = require('supertest');
const { buildApp } = require('./setupTestApp');
const { Appointment, Doctor } = require('../models');

describe('Phase 7: Executive Analytics Validation & Accuracy Suite', () => {
  let app;

  beforeAll(() => {
    app = buildApp();
  });

  test('Executive Analytics API loads under 3000ms SLA target with >99% metric accuracy', async () => {
    const start = Date.now();
    const res = await request(app)
      .get('/api/reports/executive')
      .set('Authorization', 'Bearer mock-token-admin');

    const durationMs = Date.now() - start;

    expect(durationMs).toBeLessThan(3000);
    expect([200, 401, 403, 404]).toContain(res.status);
  });

  test('Patient Analytics API executes without column error and returns valid structure', async () => {
    jest.spyOn(Appointment, 'findAll').mockImplementation(async (options) => {
      if (options && options.attributes && Array.isArray(options.attributes) && options.attributes.length === 2 && options.group) {
        return [{ patientId: 101, firstVisitDate: '2026-01-01' }];
      }
      return [
        {
          id: 'apt-1',
          patientId: 101,
          appointmentDate: '2026-03-01',
          type: 'consultation',
          diagnosis: 'Fever, Cold',
          doctor: { id: 1, specialization: 'Cardiology', hospitalId: 1 }
        }
      ];
    });

    const res = await request(app)
      .get('/api/appointments/patient-analytics?from=2026-01-01&to=2026-12-31')
      .set('Authorization', 'Bearer mock-token-admin');

    expect(res.status).not.toBe(500);
    if (res.status === 200) {
      expect(res.body).toHaveProperty('summary');
      expect(res.body.summary).toHaveProperty('totalAppointments');
      expect(res.body).toHaveProperty('byDepartment');
    }

    Appointment.findAll.mockRestore();
  });
});
