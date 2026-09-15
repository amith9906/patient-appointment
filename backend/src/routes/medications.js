const router = require('express').Router();
const c = require('../controllers/medicationController');
const { authenticate, authorize } = require('../middleware/auth');
const { cacheMiddleware } = require('../utils/cache');

router.use(authenticate);
router.get('/', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician', 'nurse', 'pharmacist'), cacheMiddleware(60, 'medications_list'), c.getAll);
router.get('/search', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician'), cacheMiddleware(60, 'medications_search'), c.search);
router.get('/recent-prescribed', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician'), cacheMiddleware(60, 'medications_recent'), c.getRecentPrescribed);
router.get('/expiry-alerts', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician'), cacheMiddleware(180, 'medications_expiry'), c.getExpiryAlerts);
router.get('/advanced-analytics', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician'), cacheMiddleware(300, 'medications_analytics'), c.getAdvancedAnalytics);
router.get('/:id/batches', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician'), cacheMiddleware(180, 'medication_batches'), c.getBatches);
router.get('/:id/ledger', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician'), cacheMiddleware(180, 'medication_ledger'), c.getStockLedger);
router.get('/:id', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician'), cacheMiddleware(300, 'medication_detail'), c.getOne);
router.post('/', authorize('super_admin', 'admin', 'receptionist'), c.create);
router.put('/:id', authorize('super_admin', 'admin', 'receptionist'), c.update);
router.patch('/:id/stock', authorize('super_admin', 'admin', 'receptionist'), c.updateStock);
router.delete('/:id', authorize('super_admin', 'admin'), c.delete);

module.exports = router;
