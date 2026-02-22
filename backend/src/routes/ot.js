const router = require('express').Router();
const c = require('../controllers/otController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/stats', authorize('super_admin', 'admin', 'receptionist', 'doctor'), c.getStats);
router.get('/', authorize('super_admin', 'admin', 'receptionist', 'doctor'), c.getAll);
router.get('/:id', authorize('super_admin', 'admin', 'receptionist', 'doctor'), c.getOne);
router.post('/', authorize('super_admin', 'admin', 'receptionist'), c.create);
router.put('/:id', authorize('super_admin', 'admin', 'doctor'), c.update);
router.patch('/:id/cancel', authorize('super_admin', 'admin', 'doctor'), c.cancel);

module.exports = router;
