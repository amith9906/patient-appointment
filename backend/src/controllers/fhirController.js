'use strict';

const { Patient, Doctor, Appointment, IPDAdmission, Vitals, Report, Prescription } = require('../models');
const FHIRMapper = require('../utils/fhirMapper');

class FHIRController {
  static async getPatientById(req, res) {
    try {
      const patient = await Patient.findByPk(req.params.id);
      if (!patient) {
        return res.status(404).json({
          resourceType: 'OperationOutcome',
          issue: [{ severity: 'error', code: 'not-found', details: { text: `Patient ID ${req.params.id} not found` } }]
        });
      }
      return res.json(FHIRMapper.toFHIRPatient(patient));
    } catch (err) {
      return res.status(500).json({
        resourceType: 'OperationOutcome',
        issue: [{ severity: 'fatal', code: 'exception', details: { text: err.message } }]
      });
    }
  }

  static async getPractitionerById(req, res) {
    try {
      const doctor = await Doctor.findByPk(req.params.id);
      if (!doctor) {
        return res.status(404).json({
          resourceType: 'OperationOutcome',
          issue: [{ severity: 'error', code: 'not-found', details: { text: `Practitioner ID ${req.params.id} not found` } }]
        });
      }
      return res.json(FHIRMapper.toFHIRPractitioner(doctor));
    } catch (err) {
      return res.status(500).json({
        resourceType: 'OperationOutcome',
        issue: [{ severity: 'fatal', code: 'exception', details: { text: err.message } }]
      });
    }
  }

  static async getEncounterById(req, res) {
    try {
      let encounter = await Appointment.findByPk(req.params.id);
      if (!encounter) {
        encounter = await IPDAdmission.findByPk(req.params.id);
      }
      if (!encounter) {
        return res.status(404).json({
          resourceType: 'OperationOutcome',
          issue: [{ severity: 'error', code: 'not-found', details: { text: `Encounter ID ${req.params.id} not found` } }]
        });
      }
      return res.json(FHIRMapper.toFHIREncounter(encounter));
    } catch (err) {
      return res.status(500).json({
        resourceType: 'OperationOutcome',
        issue: [{ severity: 'fatal', code: 'exception', details: { text: err.message } }]
      });
    }
  }

  static async getObservationById(req, res) {
    try {
      const vital = await Vitals.findByPk(req.params.id);
      if (!vital) {
        return res.status(404).json({
          resourceType: 'OperationOutcome',
          issue: [{ severity: 'error', code: 'not-found', details: { text: `Observation ID ${req.params.id} not found` } }]
        });
      }
      return res.json(FHIRMapper.toFHIRObservation(vital));
    } catch (err) {
      return res.status(500).json({
        resourceType: 'OperationOutcome',
        issue: [{ severity: 'fatal', code: 'exception', details: { text: err.message } }]
      });
    }
  }

  static async getDiagnosticReportById(req, res) {
    try {
      const report = await Report.findByPk(req.params.id);
      if (!report) {
        return res.status(404).json({
          resourceType: 'OperationOutcome',
          issue: [{ severity: 'error', code: 'not-found', details: { text: `DiagnosticReport ID ${req.params.id} not found` } }]
        });
      }
      return res.json(FHIRMapper.toFHIRDiagnosticReport(report));
    } catch (err) {
      return res.status(500).json({
        resourceType: 'OperationOutcome',
        issue: [{ severity: 'fatal', code: 'exception', details: { text: err.message } }]
      });
    }
  }

  static async getMedicationRequestById(req, res) {
    try {
      const rx = await Prescription.findByPk(req.params.id);
      if (!rx) {
        return res.status(404).json({
          resourceType: 'OperationOutcome',
          issue: [{ severity: 'error', code: 'not-found', details: { text: `MedicationRequest ID ${req.params.id} not found` } }]
        });
      }
      return res.json(FHIRMapper.toFHIRMedicationRequest(rx));
    } catch (err) {
      return res.status(500).json({
        resourceType: 'OperationOutcome',
        issue: [{ severity: 'fatal', code: 'exception', details: { text: err.message } }]
      });
    }
  }

  static async processBundle(req, res) {
    try {
      const bundle = req.body;
      if (!bundle || bundle.resourceType !== 'Bundle') {
        return res.status(400).json({
          resourceType: 'OperationOutcome',
          issue: [{ severity: 'error', code: 'structure', details: { text: 'Payload must be a FHIR Bundle' } }]
        });
      }
      return res.json({
        resourceType: 'Bundle',
        type: 'batch-response',
        entry: (bundle.entry || []).map(e => ({
          response: { status: '200 OK', location: `${e.resource?.resourceType}/${e.resource?.id || '1'}` }
        }))
      });
    } catch (err) {
      return res.status(500).json({
        resourceType: 'OperationOutcome',
        issue: [{ severity: 'fatal', code: 'exception', details: { text: err.message } }]
      });
    }
  }
}

module.exports = FHIRController;
