const express = require('express');
const router = express.Router();
const fluidBalanceController = require('../controllers/fluidBalanceController');
const { authenticate: protect } = require('../middleware/auth');

router.post('/', protect, fluidBalanceController.record);
router.get('/history', protect, fluidBalanceController.getHistory);
router.delete('/:id', protect, fluidBalanceController.deleteLog);

module.exports = router;
