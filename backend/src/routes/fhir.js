'use strict';

const express = require('express');
const router = express.Router();
const FHIRController = require('../controllers/fhirController');
const { validateFHIRHeaders, validateFHIRResource } = require('../middleware/fhirValidation');

router.use(validateFHIRHeaders);

router.get('/Patient/:id', FHIRController.getPatientById);
router.get('/Practitioner/:id', FHIRController.getPractitionerById);
router.get('/Encounter/:id', FHIRController.getEncounterById);
router.get('/Observation/:id', FHIRController.getObservationById);
router.get('/DiagnosticReport/:id', FHIRController.getDiagnosticReportById);
router.get('/MedicationRequest/:id', FHIRController.getMedicationRequestById);

router.post('/Bundle', validateFHIRResource, FHIRController.processBundle);

module.exports = router;
