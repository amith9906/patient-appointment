'use strict';

const express = require('express');
const router = express.Router();
const ObservabilityController = require('../controllers/observabilityController');

router.get('/metrics', ObservabilityController.getMetrics);
router.get('/health/readiness', ObservabilityController.getReadiness);
router.get('/health/liveness', ObservabilityController.getLiveness);

module.exports = router;
