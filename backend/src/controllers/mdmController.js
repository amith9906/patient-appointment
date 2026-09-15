'use strict';

const MDMService = require('../services/mdmService');

class MDMController {
  static async getCatalogs(req, res) {
    try {
      const catalogs = await MDMService.getCatalogs();
      return res.json(catalogs);
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }

  static async publish(req, res) {
    try {
      const { catalogCode, version, dataPayload } = req.body;
      const result = await MDMService.publishVersion({
        catalogCode,
        version,
        dataPayload,
        userId: req.user?.id
      });
      return res.status(201).json(result);
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }
}

module.exports = MDMController;
