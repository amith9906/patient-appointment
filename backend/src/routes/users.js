const router = require('express').Router();
const c = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.get('/stats', authorize('super_admin', 'admin'), c.getStats);
router.get('/', authorize('super_admin', 'admin'), c.getAll);
router.get('/:id', authorize('super_admin', 'admin'), c.getOne);
router.post('/', authorize('super_admin', 'admin'), c.create);
router.post('/:id/assign-doctor', authorize('super_admin', 'admin'), c.assignDoctorProfile);
router.put('/:id', authorize('super_admin', 'admin'), c.update);
router.patch('/:id/toggle', authorize('super_admin', 'admin'), c.toggleActive);

module.exports = router;
