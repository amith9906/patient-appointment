const router = require('express').Router();
const c = require('../controllers/doctorLeaveController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.get('/check', c.checkLeave);
router.get('/', authorize('super_admin', 'admin', 'receptionist', 'doctor'), c.getAll);
router.post('/', authorize('super_admin', 'admin', 'receptionist'), c.create);
router.delete('/:id', authorize('super_admin', 'admin', 'receptionist'), c.delete);

module.exports = router;
