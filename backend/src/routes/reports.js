const router = require('express').Router();
const c = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

const { cacheMiddleware } = require('../utils/cache');

router.use(authenticate);
router.get('/billing', authorize('super_admin', 'admin', 'receptionist'), cacheMiddleware(180, 'reports_billing'), c.getBillingReport);

router.get('/wait-times', authorize('super_admin', 'admin', 'receptionist', 'doctor'), cacheMiddleware(180, 'reports_wait_times'), c.getWaitTimeAnalytics);

router.get('/patient/:patientId', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician', 'patient'), cacheMiddleware(60, 'patient_reports'), c.getPatientReports);
router.get('/:id', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician', 'patient'), c.getOne);
router.post('/patient/:patientId/upload', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician'), upload.single('file'), c.upload);
router.get('/:id/download', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician', 'patient'), c.download);
router.get('/:id/view', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician', 'patient'), c.view);
router.delete('/:id', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician'), c.delete);

module.exports = router;
