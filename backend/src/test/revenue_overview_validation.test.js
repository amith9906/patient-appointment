const request = require('supertest');
const jwt = require('jsonwebtoken');
const { buildApp } = require('./setupTestApp');
const { Appointment, IPDPayment, MedicineInvoice, TreatmentPlan, User } = require('../models');

describe('Revenue Overview Calculation Verification', () => {
  let app;
  let token;

  beforeAll(() => {
    app = buildApp();
    token = jwt.sign(
      { id: 1, role: 'super_admin', isActive: true },
      process.env.JWT_SECRET || 'fallback-secret-for-dev-only-do-not-use-in-production'
    );
  });

  test('getRevenueOverview calculates grand total, source breakdown, and percentages correctly', async () => {
    jest.spyOn(User, 'findByPk').mockResolvedValue({
      id: 1,
      role: 'super_admin',
      isActive: true,
      hospitalId: 1
    });

    jest.spyOn(Appointment, 'findAll').mockResolvedValue([
      { fee: 500, treatmentBill: 1500, doctor: { id: 1, department: { id: 10, name: 'Cardiology' } } },
      { fee: 300, treatmentBill: 700, doctor: { id: 2, department: { id: 20, name: 'Neurology' } } }
    ]);
    jest.spyOn(IPDPayment, 'sum').mockResolvedValue(5000);
    jest.spyOn(MedicineInvoice, 'sum').mockResolvedValue(2000);
    jest.spyOn(TreatmentPlan, 'sum').mockResolvedValue(1000);
    jest.spyOn(IPDPayment, 'findAll').mockResolvedValue([]);

    const res = await request(app)
      .get('/api/appointments/revenue-overview')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const body = res.body;

    // Mathematical verification:
    // OPD Consultation = 500 + 300 = 800
    // OPD Treatment = 1500 + 700 = 2200
    // OPD Total = 3000
    // IPD Revenue = 5000
    // Pharmacy Revenue = 2000
    // Treatment Revenue = 1000
    // Grand Total = 3000 + 5000 + 2000 + 1000 = 11000

    expect(body.grandTotal).toBe(11000);
    expect(body.breakdown.opdTotal).toBe(3000);
    expect(body.breakdown.ipdRevenue).toBe(5000);
    expect(body.breakdown.pharmacyRevenue).toBe(2000);
    expect(body.breakdown.treatmentRevenue).toBe(1000);

    const calcSum = body.bySource.reduce((acc, curr) => acc + curr.amount, 0);
    expect(calcSum).toBe(11000);

    const opdConsultationPct = body.bySource.find(s => s.source === 'OPD Consultation').pct;
    const expectedPct = Number(((800 / 11000) * 100).toFixed(1));
    expect(opdConsultationPct).toBe(expectedPct);

    User.findByPk.mockRestore();
    Appointment.findAll.mockRestore();
    IPDPayment.sum.mockRestore();
    MedicineInvoice.sum.mockRestore();
    TreatmentPlan.sum.mockRestore();
    IPDPayment.findAll.mockRestore();
  });
});
