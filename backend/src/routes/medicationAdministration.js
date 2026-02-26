const express = require('express');
const router = express.Router();
const medicationAdministrationController = require('../controllers/medicationAdministrationController');
const { authenticate: protect } = require('../middleware/auth');

router.post('/', protect, medicationAdministrationController.record);
router.get('/logs', protect, medicationAdministrationController.getLogs);
router.delete('/:id', protect, medicationAdministrationController.deleteLog);

module.exports = router;
