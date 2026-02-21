const router = require('express').Router();
const c = require('../controllers/labController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Labs
router.get('/', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician'), c.getAllLabs);
router.post('/', authorize('super_admin', 'admin'), c.createLab);
router.put('/:id', authorize('super_admin', 'admin'), c.updateLab);
router.delete('/:id', authorize('super_admin', 'admin'), c.deleteLab);

// Lab Tests
router.get('/tests', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician'), c.getAllTests);
router.get('/tests/:id', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician'), c.getOneTest);
router.post('/tests', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician'), c.createTest);
router.put('/tests/:id', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician'), c.updateTest);
router.delete('/tests/:id', authorize('super_admin', 'admin', 'lab_technician'), c.deleteTest);

module.exports = router;
