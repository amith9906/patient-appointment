const router = require('express').Router();
const c = require('../controllers/corporateController');
const { authenticate, authorize } = require('../middleware/auth');

const { cacheMiddleware } = require('../utils/cache');

router.use(authenticate);
router.get('/', authorize('super_admin', 'admin', 'receptionist'), cacheMiddleware(180, 'corporates_list'), c.getAll);
router.post('/', authorize('super_admin', 'admin'), c.create);
router.put('/:id', authorize('super_admin', 'admin'), c.update);
router.delete('/:id', authorize('super_admin', 'admin'), c.delete);
router.get('/:id/ledger', authorize('super_admin', 'admin', 'receptionist'), cacheMiddleware(120, 'corporates_ledger'), c.getLedger);

router.post('/:id/invoices', authorize('super_admin', 'admin', 'receptionist'), c.postAppointmentInvoice);
router.post('/:id/payments', authorize('super_admin', 'admin', 'receptionist'), c.postPayment);

module.exports = router;

