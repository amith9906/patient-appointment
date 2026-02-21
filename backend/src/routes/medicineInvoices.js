const router = require('express').Router();
const c = require('../controllers/medicineInvoiceController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', authorize('super_admin', 'admin', 'receptionist'), c.getAll);
router.get('/analytics', authorize('super_admin', 'admin'), c.getAnalytics);
router.get('/gst-report', authorize('super_admin', 'admin'), c.getGSTReport);
router.get('/gstr1', authorize('super_admin', 'admin'), c.getGSTR1);
router.get('/gstr3b', authorize('super_admin', 'admin'), c.getGSTR3B);
router.get('/gst-marg-export', authorize('super_admin', 'admin'), c.getMargGstExport);
router.get('/:id/returns', authorize('super_admin', 'admin', 'receptionist'), c.getReturns);
router.post('/:id/returns', authorize('super_admin', 'admin', 'receptionist'), c.createReturn);
router.get('/:id', authorize('super_admin', 'admin', 'receptionist'), c.getOne);
router.post('/', authorize('super_admin', 'admin', 'receptionist'), c.create);
router.patch('/:id/mark-paid', authorize('super_admin', 'admin', 'receptionist'), c.markPaid);

module.exports = router;
