const router = require('express').Router();
const multer = require('multer');
const c = require('../controllers/bulkUploadController');
const { authenticate, authorize } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.endsWith('.xlsx') ||
      file.originalname.endsWith('.xls')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx / .xls) are allowed'));
    }
  },
});

router.use(authenticate);

// Template downloads (any authenticated user)
router.get('/template/medications', c.downloadMedicationTemplate);
router.get('/template/patients', c.downloadPatientTemplate);

// Bulk uploads (admin or receptionist)
router.post('/upload/medications', authorize('admin', 'receptionist'), upload.single('file'), c.uploadMedications);
router.post('/upload/patients', authorize('admin', 'receptionist'), upload.single('file'), c.uploadPatients);

module.exports = router;
