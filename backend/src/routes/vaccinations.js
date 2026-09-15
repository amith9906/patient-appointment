const express = require('express');
const router = express.Router();
const vaccinationController = require('../controllers/vaccinationController');
const { authenticate } = require('../middleware/auth');

router.get('/patient/:patientId', authenticate, vaccinationController.getPatientVaccinations);
router.post('/patient/:patientId/auto-generate', authenticate, vaccinationController.autoGenerateSchedule);
router.post('/patient/:patientId', authenticate, vaccinationController.createVaccination);
router.put('/:id', authenticate, vaccinationController.updateVaccination);
router.delete('/:id', authenticate, vaccinationController.deleteVaccination);

module.exports = router;
