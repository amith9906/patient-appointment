const router = require('express').Router();
const c = require('../controllers/pdfController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.get('/prescription/:appointmentId', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician', 'patient'), c.generatePrescription);
router.get('/bill/:appointmentId', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician', 'patient'), c.generateBill);
router.get('/receipt/:appointmentId', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician', 'patient'), c.generateReceipt);
router.get('/lab-report/:labTestId', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician', 'patient'), c.generateLabReport);
router.get('/medicine-invoice/:invoiceId', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician', 'patient'), c.generateMedicineInvoice);
router.get('/medicine-return/:returnId', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician'), c.generateMedicineReturnNote);
router.get('/purchase-return/:returnId', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician'), c.generatePurchaseReturnNote);

module.exports = router;
