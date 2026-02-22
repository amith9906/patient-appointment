const router = require('express').Router();
const c = require('../controllers/ipdController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Stats
router.get('/stats', authorize('super_admin', 'admin', 'receptionist', 'doctor'), c.getStats);

// Rooms
router.get('/rooms', authorize('super_admin', 'admin', 'receptionist', 'doctor'), c.getRooms);
router.post('/rooms', authorize('super_admin', 'admin'), c.createRoom);
router.put('/rooms/:id', authorize('super_admin', 'admin'), c.updateRoom);
router.delete('/rooms/:id', authorize('super_admin', 'admin'), c.deleteRoom);

// Billing (must come before /:id to avoid route conflict)
router.get('/:id/bill', authorize('super_admin', 'admin', 'receptionist', 'doctor'), c.getBill);
router.post('/:id/bill/items', authorize('super_admin', 'admin', 'receptionist'), c.addBillItem);
router.put('/:id/bill/items/:itemId', authorize('super_admin', 'admin', 'receptionist'), c.updateBillItem);
router.delete('/:id/bill/items/:itemId', authorize('super_admin', 'admin'), c.deleteBillItem);
router.post('/:id/bill/payments', authorize('super_admin', 'admin', 'receptionist'), c.addPayment);
router.delete('/:id/bill/payments/:paymentId', authorize('super_admin', 'admin'), c.deletePayment);
router.patch('/:id/bill/discount', authorize('super_admin', 'admin'), c.updateDiscount);

// Admissions
router.get('/', authorize('super_admin', 'admin', 'receptionist', 'doctor'), c.getAdmissions);
router.get('/:id', authorize('super_admin', 'admin', 'receptionist', 'doctor'), c.getAdmission);
router.post('/', authorize('super_admin', 'admin', 'receptionist'), c.admitPatient);
router.put('/:id', authorize('super_admin', 'admin', 'receptionist', 'doctor'), c.updateAdmission);
router.patch('/:id/discharge', authorize('super_admin', 'admin', 'doctor'), c.dischargePatient);
router.post('/:id/notes', authorize('super_admin', 'admin', 'doctor'), c.addNote);

module.exports = router;
