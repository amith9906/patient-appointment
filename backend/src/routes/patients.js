const router = require('express').Router();
const c = require('../controllers/patientController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
// Patient-self routes (must be before /:id)
router.get('/me', authorize('patient'), c.getMe);
router.get('/me/appointments', authorize('patient'), c.getMyAppointments);
router.get('/me/reports', authorize('patient'), c.getMyReports);
router.post('/me/book', authorize('patient'), c.bookAppointment);
// Staff routes
router.get('/', authorize('super_admin', 'admin', 'receptionist', 'doctor'), c.getAll);
router.get('/:id', authorize('super_admin', 'admin', 'receptionist', 'doctor'), c.getOne);
router.get('/:id/history', authorize('super_admin', 'admin', 'receptionist', 'doctor'), c.getMedicalHistory);
router.post('/', authorize('super_admin', 'admin', 'receptionist'), c.create);
router.put('/:id', authorize('super_admin', 'admin', 'receptionist'), c.update);
router.delete('/:id', authorize('super_admin', 'admin'), c.delete);

module.exports = router;
