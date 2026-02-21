const router = require('express').Router();
const c = require('../controllers/stockPurchaseController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.get('/', authorize('super_admin', 'admin', 'receptionist'), c.getAll);
router.post('/', authorize('super_admin', 'admin', 'receptionist'), c.create);
router.get('/:id/returns', authorize('super_admin', 'admin', 'receptionist'), c.getReturns);
router.post('/:id/return', authorize('super_admin', 'admin', 'receptionist'), c.createReturn);

module.exports = router;
