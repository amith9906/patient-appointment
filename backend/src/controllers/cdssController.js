'use strict';

const CDSSService = require('../services/cdssService');
const { ClinicalOverrideLog } = require('../models');

class CDSSController {
  static async evaluate(req, res) {
    try {
      const evaluation = await CDSSService.evaluatePrescription(req.body);
      return res.json(evaluation);
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }

  static async logOverride(req, res) {
    try {
      const { hospitalId, patientId, doctorId, alertType, alertDetails, overrideReason } = req.body;
      if (!overrideReason) {
        return res.status(400).json({ message: 'Override reason is required for hard-stop clinical alerts.' });
      }

      const log = await ClinicalOverrideLog.create({
        hospitalId: hospitalId || req.user?.hospitalId || 1,
        patientId,
        doctorId: doctorId || req.user?.id,
        alertType,
        alertDetails: alertDetails || {},
        overrideReason
      });

      return res.status(201).json({ message: 'Clinical override logged successfully.', overrideId: log.id });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }
}

module.exports = CDSSController;
