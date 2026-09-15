'use strict';

/**
 * FHIR R4 Resource Mapper
 * Converts HMS internal database models into HL7 FHIR R4 compliant JSON payloads
 * and provides reverse mapping for ABDM interoperability.
 */

class FHIRMapper {
  /**
   * Map Patient model to FHIR Patient resource
   */
  static toFHIRPatient(patient) {
    if (!patient) return null;
    const nameParts = (patient.name || 'Unknown Patient').split(' ');
    const familyName = nameParts.length > 1 ? nameParts.pop() : '';
    const givenName = nameParts.join(' ') || 'Unknown';

    return {
      resourceType: 'Patient',
      id: String(patient.id),
      meta: {
        versionId: '1',
        lastUpdated: patient.updatedAt ? new Date(patient.updatedAt).toISOString() : new Date().toISOString(),
        profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/Patient']
      },
      identifier: [
        {
          system: 'http://abdm.gov.in/uhid',
          value: patient.uhid || `UHID-${patient.id}`
        },
        ...(patient.aadhaarNumber ? [{
          system: 'https://uidai.gov.in/aadhaar',
          value: patient.aadhaarNumber
        }] : [])
      ],
      active: true,
      name: [
        {
          use: 'official',
          family: familyName,
          given: [givenName]
        }
      ],
      telecom: [
        ...(patient.phone ? [{ system: 'phone', value: patient.phone, use: 'mobile' }] : []),
        ...(patient.email ? [{ system: 'email', value: patient.email }] : [])
      ],
      gender: (patient.gender || 'unknown').toLowerCase(),
      birthDate: patient.dateOfBirth ? new Date(patient.dateOfBirth).toISOString().slice(0, 10) : undefined,
      address: patient.address ? [
        {
          use: 'home',
          text: patient.address,
          city: patient.city || undefined,
          state: patient.state || undefined,
          postalCode: patient.pincode || undefined,
          country: 'IND'
        }
      ] : undefined
    };
  }

  /**
   * Map Doctor/User model to FHIR Practitioner resource
   */
  static toFHIRPractitioner(doctor) {
    if (!doctor) return null;
    return {
      resourceType: 'Practitioner',
      id: String(doctor.id),
      meta: {
        versionId: '1',
        profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/Practitioner']
      },
      identifier: [
        {
          system: 'https://doctor.ndhm.gov.in/registration-number',
          value: doctor.registrationNumber || `REG-${doctor.id}`
        }
      ],
      active: true,
      name: [
        {
          prefix: ['Dr.'],
          text: doctor.name || doctor.user?.name || 'Practitioner'
        }
      ],
      qualification: doctor.qualification ? [
        {
          code: {
            text: doctor.qualification
          }
        }
      ] : []
    };
  }

  /**
   * Map Appointment or IPDAdmission model to FHIR Encounter resource
   */
  static toFHIREncounter(encounter) {
    if (!encounter) return null;
    const isIPD = encounter.admissionDate !== undefined;
    return {
      resourceType: 'Encounter',
      id: String(encounter.id),
      meta: {
        profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/Encounter']
      },
      status: encounter.status === 'completed' || encounter.status === 'discharged' ? 'finished' : 'in-progress',
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: isIPD ? 'IMP' : 'AMB',
        display: isIPD ? 'inpatient encounter' : 'ambulatory'
      },
      subject: {
        reference: `Patient/${encounter.patientId}`
      },
      participant: encounter.doctorId ? [
        {
          individual: {
            reference: `Practitioner/${encounter.doctorId}`
          }
        }
      ] : [],
      period: {
        start: encounter.appointmentDate || encounter.admissionDate,
        end: encounter.dischargeDate || undefined
      }
    };
  }

  /**
   * Map Vitals model to FHIR Observation resource
   */
  static toFHIRObservation(vital) {
    if (!vital) return null;
    return {
      resourceType: 'Observation',
      id: String(vital.id),
      meta: {
        profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/Observation']
      },
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'vital-signs',
              display: 'Vital Signs'
            }
          ]
        }
      ],
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '85354-9',
            display: 'Blood pressure panel with all children optional'
          }
        ],
        text: 'Vitals Entry'
      },
      subject: {
        reference: `Patient/${vital.patientId}`
      },
      effectiveDateTime: vital.createdAt || new Date().toISOString(),
      component: [
        ...(vital.bpSystolic ? [{
          code: { coding: [{ system: 'http://loinc.org', code: '8480-6', display: 'Systolic blood pressure' }] },
          valueQuantity: { value: Number(vital.bpSystolic), unit: 'mmHg' }
        }] : []),
        ...(vital.bpDiastolic ? [{
          code: { coding: [{ system: 'http://loinc.org', code: '8462-4', display: 'Diastolic blood pressure' }] },
          valueQuantity: { value: Number(vital.bpDiastolic), unit: 'mmHg' }
        }] : []),
        ...(vital.pulseRate ? [{
          code: { coding: [{ system: 'http://loinc.org', code: '8867-4', display: 'Heart rate' }] },
          valueQuantity: { value: Number(vital.pulseRate), unit: '/min' }
        }] : [])
      ]
    };
  }

  /**
   * Map Lab Test Report model to FHIR DiagnosticReport resource
   */
  static toFHIRDiagnosticReport(report) {
    if (!report) return null;
    return {
      resourceType: 'DiagnosticReport',
      id: String(report.id),
      meta: {
        profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/DiagnosticReport']
      },
      status: report.status === 'completed' ? 'final' : 'partial',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
              code: 'LAB',
              display: 'Laboratory'
            }
          ]
        }
      ],
      code: {
        text: report.testName || 'Diagnostic Report'
      },
      subject: {
        reference: `Patient/${report.patientId}`
      },
      effectiveDateTime: report.createdAt || new Date().toISOString(),
      conclusion: report.resultSummary || report.comments || 'No significant findings.'
    };
  }

  /**
   * Map Prescription to FHIR MedicationRequest resource
   */
  static toFHIRMedicationRequest(prescription) {
    if (!prescription) return null;
    return {
      resourceType: 'MedicationRequest',
      id: String(prescription.id),
      meta: {
        profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/MedicationRequest']
      },
      status: 'active',
      intent: 'order',
      medicationCodeableConcept: {
        text: prescription.medicationName || prescription.medicine?.name || 'Prescribed Medicine'
      },
      subject: {
        reference: `Patient/${prescription.patientId}`
      },
      requester: {
        reference: `Practitioner/${prescription.doctorId}`
      },
      dosageInstruction: [
        {
          text: prescription.dosage || prescription.frequency || 'As directed by physician',
          timing: {
            repeat: {
              duration: prescription.durationDays || 5,
              durationUnit: 'd'
            }
          }
        }
      ]
    };
  }
}

module.exports = FHIRMapper;
