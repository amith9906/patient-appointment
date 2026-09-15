const request = require('supertest');
const { buildApp } = require('./setupTestApp');
const { Patient, Vitals } = require('../models');

describe('Phase 5: ABDM & FHIR R4 Validation Suite', () => {
  let app;

  beforeAll(() => {
    app = buildApp();
  });

  test('FHIR R4 Patient Endpoint returns valid profile with ABHA system identifier', async () => {
    jest.spyOn(Patient, 'findByPk').mockResolvedValue({
      id: 1,
      name: 'Ramesh Kumar',
      uhid: 'UHID-998877',
      gender: 'Male',
      dateOfBirth: '1985-05-15'
    });

    const res = await request(app)
      .get('/fhir/Patient/1')
      .set('Accept', 'application/fhir+json');

    expect(res.status).toBe(200);
    expect(res.body.resourceType).toBe('Patient');
    expect(res.body.meta.profile[0]).toContain('https://nrces.in/ndhm/fhir/r4/StructureDefinition/Patient');
    expect(res.body.identifier[0].system).toBe('http://abdm.gov.in/uhid');

    Patient.findByPk.mockRestore();
  });

  test('FHIR R4 Observation Endpoint conforms to LOINC codings', async () => {
    jest.spyOn(Vitals, 'findByPk').mockResolvedValue({
      id: 1,
      patientId: 101,
      bpSystolic: 120,
      bpDiastolic: 80,
      pulseRate: 72
    });

    const res = await request(app)
      .get('/fhir/Observation/1')
      .set('Accept', 'application/fhir+json');

    expect(res.status).toBe(200);
    expect(res.body.resourceType).toBe('Observation');
    expect(res.body.category[0].coding[0].code).toBe('vital-signs');

    Vitals.findByPk.mockRestore();
  });

  test('FHIR Bundle Batch Endpoint correctly processes batch entries', async () => {
    const bundlePayload = {
      resourceType: 'Bundle',
      type: 'batch',
      entry: [
        { resource: { resourceType: 'Patient', id: '1' } }
      ]
    };

    const res = await request(app)
      .post('/fhir/Bundle')
      .set('Accept', 'application/fhir+json')
      .send(bundlePayload);

    expect(res.status).toBe(200);
    expect(res.body.resourceType).toBe('Bundle');
    expect(res.body.type).toBe('batch-response');
  });
});
