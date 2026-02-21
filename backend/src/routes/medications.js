const router = require('express').Router();
const c = require('../controllers/medicationController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.get('/', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician'), c.getAll);
router.get('/expiry-alerts', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician'), c.getExpiryAlerts);
router.get('/advanced-analytics', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician'), c.getAdvancedAnalytics);
router.get('/:id/batches', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician'), c.getBatches);
router.get('/:id/ledger', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician'), c.getStockLedger);
router.get('/:id', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician'), c.getOne);
router.post('/', authorize('super_admin', 'admin', 'receptionist'), c.create);
router.put('/:id', authorize('super_admin', 'admin', 'receptionist'), c.update);
router.patch('/:id/stock', authorize('super_admin', 'admin', 'receptionist'), c.updateStock);
router.delete('/:id', authorize('super_admin', 'admin'), c.delete);

module.exports = router;
