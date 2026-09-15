'use strict';

const GlobalSearchService = require('../services/globalSearchService');

class GlobalSearchController {
  static async globalSearch(req, res) {
    const startTime = Date.now();
    try {
      const q = req.query.q;
      const hospitalId = req.user?.hospitalId || req.query.hospitalId || 1;
      const results = await GlobalSearchService.search({ q, hospitalId });
      const durationMs = Date.now() - startTime;

      return res.json({
        query: q,
        tookMs: durationMs,
        count: results.length,
        results
      });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }
}

module.exports = GlobalSearchController;
