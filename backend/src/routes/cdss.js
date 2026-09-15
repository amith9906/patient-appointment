'use strict';

const express = require('express');
const router = express.Router();
const CDSSController = require('../controllers/cdssController');
const { authenticate } = require('../middleware/auth');

router.post('/evaluate', authenticate, CDSSController.evaluate);
router.post('/override', authenticate, CDSSController.logOverride);

module.exports = router;
