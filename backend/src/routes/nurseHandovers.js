const express = require('express');
const router = express.Router();
const nurseHandoverController = require('../controllers/nurseHandoverController');
const { authenticate: protect } = require('../middleware/auth');

router.post('/', protect, nurseHandoverController.createHandover);
router.get('/', protect, nurseHandoverController.getHandovers);
router.patch('/:id/sign-off', protect, nurseHandoverController.signOff);

module.exports = router;
