const router = require('express').Router();
const c = require('../controllers/patientPortalController');
const { authenticatePatientPortal } = require('../middleware/patientPortalAuth');

// Public OTP Auth routes
router.post('/auth/request-otp', c.requestOtp);
router.post('/auth/verify-otp', c.verifyOtp);

// Authenticated Patient Portal routes (Protected by authenticatePatientPortal)
router.get('/me', authenticatePatientPortal, c.getMe);
router.get('/appointments', authenticatePatientPortal, c.getAppointments);
router.get('/prescriptions', authenticatePatientPortal, c.getPrescriptions);
router.get('/reports', authenticatePatientPortal, c.getReports);
router.get('/reports/:id/view', authenticatePatientPortal, c.viewReport);
router.get('/invoices', authenticatePatientPortal, c.getInvoices);

module.exports = router;
