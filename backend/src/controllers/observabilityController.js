'use strict';

const MetricsService = require('../services/metricsService');

class ObservabilityController {
  static getMetrics(req, res) {
    return res.json(MetricsService.getMetrics());
  }

  static async getReadiness(req, res) {
    const readiness = await MetricsService.checkReadiness();
    if (readiness.status === 'READY') {
      return res.status(200).json(readiness);
    }
    return res.status(503).json(readiness);
  }

  static getLiveness(req, res) {
    return res.status(200).json(MetricsService.checkLiveness());
  }
}

module.exports = ObservabilityController;
