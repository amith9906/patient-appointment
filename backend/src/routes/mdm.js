'use strict';

const express = require('express');
const router = express.Router();
const MDMController = require('../controllers/mdmController');
const { authenticate } = require('../middleware/auth');

router.get('/catalogs', authenticate, MDMController.getCatalogs);
router.post('/catalogs/publish', authenticate, MDMController.publish);

module.exports = router;
