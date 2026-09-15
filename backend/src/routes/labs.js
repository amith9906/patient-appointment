const router = require('express').Router();
const c = require('../controllers/labController');
const { authenticate, authorize } = require('../middleware/auth');

const { cacheMiddleware } = require('../utils/cache');

router.use(authenticate);

// Labs
router.get('/', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician'), cacheMiddleware(120, 'labs_list'), c.getAllLabs);
router.post('/', authorize('super_admin', 'admin'), c.createLab);
router.put('/:id', authorize('super_admin', 'admin'), c.updateLab);
router.delete('/:id', authorize('super_admin', 'admin'), c.deleteLab);

// Lab Tests
router.get('/tests', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician'), cacheMiddleware(60, 'lab_tests_list'), c.getAllTests);
router.get('/tests/:id', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician'), c.getOneTest);
router.post('/tests', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician'), c.createTest);
router.put('/tests/:id', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician'), c.updateTest);
router.delete('/tests/:id', authorize('super_admin', 'admin', 'lab_technician'), c.deleteTest);

module.exports = router;
