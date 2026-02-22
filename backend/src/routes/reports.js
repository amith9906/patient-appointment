const router = require('express').Router();
const c = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(authenticate);
router.get('/patient/:patientId', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician', 'patient'), c.getPatientReports);
router.get('/:id', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician', 'patient'), c.getOne);
router.post('/patient/:patientId/upload', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician'), upload.single('file'), c.upload);
router.get('/:id/download', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician', 'patient'), c.download);
router.get('/:id/view', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician', 'patient'), c.view);
router.delete('/:id', authorize('super_admin', 'admin', 'receptionist', 'doctor', 'lab_technician'), c.delete);

module.exports = router;
