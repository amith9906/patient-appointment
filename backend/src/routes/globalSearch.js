'use strict';

const express = require('express');
const router = express.Router();
const GlobalSearchController = require('../controllers/globalSearchController');
const { authenticate } = require('../middleware/auth');

router.get('/global', authenticate, GlobalSearchController.globalSearch);

module.exports = router;
