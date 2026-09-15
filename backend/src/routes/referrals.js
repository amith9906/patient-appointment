const router = require('express').Router();
const c = require('../controllers/referralController');
const { authenticate, authorize } = require('../middleware/auth');
const { cacheMiddleware } = require('../utils/cache');

router.use(authenticate);

router.get('/', authorize('super_admin', 'admin', 'receptionist', 'doctor'), cacheMiddleware(60, 'referrals_list'), c.getAll);
router.get('/:id', authorize('super_admin', 'admin', 'receptionist', 'doctor'), cacheMiddleware(60, 'referrals_detail'), c.getOne);
router.post('/', authorize('super_admin', 'admin', 'receptionist', 'doctor'), c.create);
router.put('/:id', authorize('super_admin', 'admin', 'receptionist', 'doctor'), c.update);
router.delete('/:id', authorize('super_admin', 'admin', 'receptionist'), c.delete);

module.exports = router;
