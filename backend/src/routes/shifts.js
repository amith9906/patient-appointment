const express = require('express');
const router = express.Router();
const shiftController = require('../controllers/shiftController');
const { authenticate: protect } = require('../middleware/auth');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.use(protect);

router.get('/', shiftController.getAllShifts);
router.post('/', shiftController.createShift);
router.put('/:id', shiftController.updateShift);
router.delete('/:id', shiftController.deleteShift);

router.get('/assignments', shiftController.getAssignments);
router.post('/assignments', shiftController.assignShift);
router.delete('/assignments/:id', shiftController.removeAssignment);
router.post('/assignments/bulk', shiftController.bulkAssign);
router.post('/assignments/clone', shiftController.cloneLastWeek);
router.post('/assignments/upload', upload.single('file'), shiftController.uploadAssignments);

module.exports = router;
