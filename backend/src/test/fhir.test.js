const FHIRMapper = require('../utils/fhirMapper');

describe('Phase 2: FHIR R4 Mapping & Validation Test Suite', () => {
  test('toFHIRPatient correctly maps Patient entity to HL7 FHIR R4 schema', () => {
    const mockPatient = {
      id: 101,
      name: 'Ramesh Kumar',
      uhid: 'UHID-998877',
      phone: '9876543210',
      gender: 'Male',
      dateOfBirth: '1985-05-15',
      address: '123 MG Road',
      city: 'Bengaluru',
      state: 'Karnataka'
    };

    const fhirResource = FHIRMapper.toFHIRPatient(mockPatient);

    expect(fhirResource.resourceType).toBe('Patient');
    expect(fhirResource.id).toBe('101');
    expect(fhirResource.identifier[0].value).toBe('UHID-998877');
    expect(fhirResource.gender).toBe('male');
    expect(fhirResource.name[0].family).toBe('Kumar');
    expect(fhirResource.name[0].given[0]).toBe('Ramesh');
  });

  test('toFHIRObservation converts Vitals model into FHIR Observation with LOINC codings', () => {
    const mockVital = {
      id: 55,
      patientId: 101,
      bpSystolic: 120,
      bpDiastolic: 80,
      pulseRate: 72,
      createdAt: new Date().toISOString()
    };

    const fhirObservation = FHIRMapper.toFHIRObservation(mockVital);
    expect(fhirObservation.resourceType).toBe('Observation');
    expect(fhirObservation.subject.reference).toBe('Patient/101');
    expect(fhirObservation.component.length).toBe(3);
  });
});
