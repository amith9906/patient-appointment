const express = require('express');
const router = express.Router();
const nurseLeaveController = require('../controllers/nurseLeaveController');
const { authenticate: protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'nurse'), nurseLeaveController.getAll);
router.post('/apply', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'nurse'), nurseLeaveController.apply);
router.put('/:id/approve', authorize('super_admin', 'admin', 'doctor'), nurseLeaveController.approve);
router.put('/:id/reject', authorize('super_admin', 'admin', 'doctor'), nurseLeaveController.reject);
router.delete('/:id', authorize('super_admin', 'admin', 'doctor', 'nurse'), nurseLeaveController.delete);

module.exports = router;
