const router = require('express').Router();
const c = require('../controllers/treatmentPlanController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.get('/', authorize('super_admin', 'admin', 'receptionist', 'doctor'), c.getAll);
router.get('/:id', authorize('super_admin', 'admin', 'receptionist', 'doctor'), c.getOne);
router.post('/', authorize('super_admin', 'admin', 'receptionist', 'doctor'), c.create);
router.put('/:id', authorize('super_admin', 'admin', 'receptionist', 'doctor'), c.update);
router.delete('/:id', authorize('super_admin', 'admin'), c.delete);

module.exports = router;
