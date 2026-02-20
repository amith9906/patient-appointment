const router = require('express').Router();
const c = require('../controllers/pdfController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);
router.get('/prescription/:appointmentId', c.generatePrescription);
router.get('/bill/:appointmentId', c.generateBill);
router.get('/receipt/:appointmentId', c.generateReceipt);
router.get('/lab-report/:labTestId', c.generateLabReport);

module.exports = router;
