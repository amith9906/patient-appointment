const router = require('express').Router();
const c  = require('../controllers/appointmentController');
const vc = require('../controllers/vitalsController');
const bc = require('../controllers/billItemController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.get('/today',      authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician'), c.getTodayAppointments);
router.get('/dashboard',  authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician'), c.getDashboardStats);
router.get('/analytics',  authorize('super_admin', 'admin'), c.getBillingAnalytics);
router.get('/',           authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician'), c.getAll);
router.get('/:id',        authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician'), c.getOne);
router.post('/',          authorize('super_admin', 'admin', 'receptionist'), c.create);
router.put('/:id',        authorize('super_admin', 'admin', 'receptionist', 'doctor'), c.update);
router.put('/:id/cancel', authorize('super_admin', 'admin', 'receptionist', 'doctor'), c.cancel);

// Vitals — any authed staff reads; receptionist + doctor can save/edit
router.get('/:id/vitals', vc.getByAppointment);
router.put('/:id/vitals', authorize('super_admin', 'admin', 'receptionist', 'doctor'), vc.upsert);

// Bill items — get is open to all staff; save restricted to admin/receptionist/doctor; mark-paid to admin/receptionist
router.get('/:id/bill-items',  bc.getByAppointment);
router.put('/:id/bill-items',  authorize('super_admin', 'admin', 'receptionist', 'doctor'), bc.saveItems);
router.patch('/:id/mark-paid', authorize('super_admin', 'admin', 'receptionist'), bc.markPaid);

module.exports = router;
