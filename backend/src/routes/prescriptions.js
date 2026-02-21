const router = require('express').Router();
const c = require('../controllers/prescriptionController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.get('/my', authorize('patient'), c.getMyPrescriptions);
router.get('/appointment/:appointmentId', c.getByAppointment);
router.post('/translate', authorize('super_admin', 'doctor', 'admin'), c.translate);
router.post('/', authorize('super_admin', 'doctor', 'admin'), c.create);
router.put('/:id', authorize('super_admin', 'doctor', 'admin'), c.update);
router.delete('/:id', authorize('super_admin', 'doctor', 'admin'), c.delete);

module.exports = router;
