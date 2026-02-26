const router = require('express').Router();
const c = require('../controllers/doctorController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
// Doctor-self routes (must be before /:id)
router.get('/me', authorize('doctor'), c.getMe);
router.get('/me/appointments', authorize('doctor'), c.getMyAppointments);
router.get('/me/patients', authorize('doctor'), c.getMyPatients);
router.get('/department/stats', authorize('doctor', 'admin', 'super_admin'), c.getDepartmentStats);
router.get('/department/doctors', authorize('doctor', 'admin', 'super_admin'), c.getDepartmentDoctors);
router.get('/availability/summary', authorize('super_admin', 'admin', 'receptionist', 'doctor'), c.getAvailabilitySummary);
router.get('/available-on', authorize('super_admin', 'admin', 'receptionist', 'doctor'), c.getAvailableOnDate);
// General routes
router.get('/', c.getAll);
router.get('/:id', c.getOne);
router.get('/:id/slots', c.getAvailableSlots);
router.get('/:id/availability', authorize('super_admin', 'admin', 'receptionist', 'doctor'), c.getAvailability);
router.post('/:id/availability', authorize('super_admin', 'admin', 'receptionist', 'doctor'), c.saveAvailability);
router.post('/', authorize('super_admin', 'admin', 'receptionist'), c.create);
router.put('/:id', authorize('super_admin', 'admin', 'receptionist', 'doctor'), c.update);
router.delete('/:id', authorize('super_admin', 'admin'), c.delete);

module.exports = router;
