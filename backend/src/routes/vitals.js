const express = require('express');
const router = express.Router();
const vitalsController = require('../controllers/vitalsController');
const { authenticate: protect } = require('../middleware/auth');

router.post('/', protect, vitalsController.record);
router.get('/history', protect, vitalsController.getHistory);
router.delete('/:id', protect, vitalsController.deleteRecord);

module.exports = router;
