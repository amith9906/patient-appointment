const router = require('express').Router();
const c = require('../controllers/reportController');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(authenticate);
router.get('/patient/:patientId', c.getPatientReports);
router.get('/:id', c.getOne);
router.post('/patient/:patientId/upload', upload.single('file'), c.upload);
router.get('/:id/download', c.download);
router.delete('/:id', c.delete);

module.exports = router;
