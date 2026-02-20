const router = require('express').Router();
const c = require('../controllers/doctorController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
// Doctor-self routes (must be before /:id)
router.get('/me', authorize('doctor'), c.getMe);
router.get('/me/appointments', authorize('doctor'), c.getMyAppointments);
router.get('/me/patients', authorize('doctor'), c.getMyPatients);
// General routes
router.get('/', c.getAll);
router.get('/:id', c.getOne);
router.get('/:id/slots', c.getAvailableSlots);
router.post('/', authorize('super_admin', 'admin', 'receptionist'), c.create);
router.put('/:id', authorize('super_admin', 'admin', 'receptionist', 'doctor'), c.update);
router.delete('/:id', authorize('super_admin', 'admin'), c.delete);

module.exports = router;
