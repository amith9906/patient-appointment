const request = require('supertest');
const jwt = require('jsonwebtoken');
const { buildApp } = require('./setupTestApp');
const { Appointment, User } = require('../models');

describe('Wait Time Analytics Calculation Verification', () => {
  let app;
  let token;

  beforeAll(() => {
    app = buildApp();
    token = jwt.sign(
      { id: 1, role: 'super_admin', isActive: true },
      process.env.JWT_SECRET || 'fallback-secret-for-dev-only-do-not-use-in-production'
    );
  });

  test('getWaitTimeAnalytics calculates wait times, consultation durations, doctor-wise & day-wise metrics correctly', async () => {
    jest.spyOn(User, 'findByPk').mockResolvedValue({
      id: 1,
      role: 'super_admin',
      isActive: true,
      hospitalId: 1
    });

    const now = new Date();
    const t0 = new Date(now.getTime() - 40 * 60 * 1000).toISOString(); // Checked in 40 mins ago
    const t1 = new Date(now.getTime() - 20 * 60 * 1000).toISOString(); // Consultation started 20 mins ago (Wait = 20m)
    const t2 = now.toISOString(); // Completed now (Duration = 20m)

    jest.spyOn(Appointment, 'findAll').mockResolvedValue([
      {
        id: 'apt-1',
        appointmentDate: '2026-03-01',
        checkedInAt: t0,
        consultationStartedAt: t1,
        completedAt: t2,
        doctorId: 10,
        doctor: { id: 10, name: 'Dr. Sharma', specialization: 'Cardiology', departmentId: 1 }
      }
    ]);

    const res = await request(app)
      .get('/api/reports/wait-times')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const body = res.body;

    expect(body.summary.totalAppointments).toBe(1);
    expect(body.summary.trackedWaitTimesCount).toBe(1);
    expect(body.summary.trackedConsultationsCount).toBe(1);
    expect(body.summary.avgWaitTimeMinutes).toBe(20);
    expect(body.summary.avgConsultationDurationMinutes).toBe(20);

    expect(body.doctorWise.length).toBe(1);
    expect(body.doctorWise[0].doctorName).toBe('Dr. Sharma');
    expect(body.doctorWise[0].avgWaitTimeMinutes).toBe(20);

    expect(body.dayWise.length).toBe(1);
    expect(body.dayWise[0].date).toBe('2026-03-01');

    User.findByPk.mockRestore();
    Appointment.findAll.mockRestore();
  });
});
