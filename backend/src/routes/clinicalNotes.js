const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const controller = require('../controllers/clinicalNoteController');

// Any authenticated caregiver can create notes; restrict editing/signing appropriately
router.post('/', authenticate, authorize('nurse', 'doctor', 'admin', 'super_admin'), controller.create);
router.get('/', authenticate, authorize('nurse', 'doctor', 'admin', 'super_admin'), controller.getAll);
router.get('/:id', authenticate, authorize('nurse', 'doctor', 'admin', 'super_admin'), controller.getOne);
router.put('/:id', authenticate, authorize('nurse', 'doctor', 'admin', 'super_admin'), controller.update);
router.post('/:id/amend', authenticate, authorize('nurse', 'doctor', 'admin', 'super_admin'), controller.amend);
router.post('/:id/sign', authenticate, authorize('doctor', 'admin', 'super_admin'), controller.sign);

module.exports = router;
