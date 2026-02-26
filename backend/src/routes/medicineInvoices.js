const router = require('express').Router();
const c = require('../controllers/medicineInvoiceController');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(authenticate);

router.get('/', authorize('super_admin', 'admin', 'receptionist'), c.getAll);
router.get('/analytics', authorize('super_admin', 'admin'), c.getAnalytics);
router.get('/gst-report', authorize('super_admin', 'admin'), c.getGSTReport);
router.get('/gstr1', authorize('super_admin', 'admin'), c.getGSTR1);
router.get('/gstr3b', authorize('super_admin', 'admin'), c.getGSTR3B);
router.get('/gst-marg-export', authorize('super_admin', 'admin'), c.getMargGstExport);
router.get('/schedule-h-log', authorize('super_admin', 'admin', 'receptionist'), c.getScheduleHLog);
router.get('/reminder-candidates', authorize('super_admin', 'admin', 'receptionist'), c.getReminderCandidates);
router.get('/barcode/:barcode', authorize('super_admin', 'admin', 'receptionist'), c.scanByBarcode);
router.post('/interaction-check', authorize('super_admin', 'admin', 'receptionist'), c.checkInteractions);
router.get('/:id/returns', authorize('super_admin', 'admin', 'receptionist'), c.getReturns);
router.post('/:id/returns', authorize('super_admin', 'admin', 'receptionist'), c.createReturn);
router.get('/:id', authorize('super_admin', 'admin', 'receptionist'), c.getOne);
router.post('/', authorize('super_admin', 'admin', 'receptionist'), c.create);
router.patch('/:id/mark-paid', authorize('super_admin', 'admin', 'receptionist'), c.markPaid);
router.patch('/:id/delivery-status', authorize('super_admin', 'admin', 'receptionist'), c.updateDeliveryStatus);
router.post('/:id/prescription', authorize('super_admin', 'admin', 'receptionist'), upload.single('file'), c.uploadPrescription);
router.post('/backfill-prescriptions', authorize('super_admin', 'admin'), c.backfillPrescriptionLinks);

module.exports = router;
