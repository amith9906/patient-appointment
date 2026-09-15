'use strict';

const { Op } = require('sequelize');
const { DrugInteraction, DrugSafetyProfile, DoseRangeRule, Patient, Vitals } = require('../models');

class CDSSService {
  /**
   * Evaluate draft prescription medications against patient clinical record
   */
  static async evaluatePrescription({ patientId, items = [], isPregnant = false, patientAge = 30, egfr = null }) {
    const alerts = [];
    let requiresHardStop = false;

    const drugNames = items.map(i => i.drugName || i.name).filter(Boolean);

    // 1. Drug-Drug Interactions Matrix Check
    if (drugNames.length >= 2) {
      const interactions = await DrugInteraction.findAll({
        where: {
          [Op.or]: [
            { drugA: { [Op.in]: drugNames }, drugB: { [Op.in]: drugNames } },
            { drugA: { [Op.in]: drugNames }, drugB: { [Op.in]: drugNames } }
          ]
        }
      });

      for (const inter of interactions) {
        if (inter.severity === 'Major') {
          requiresHardStop = true;
        }
        alerts.push({
          type: 'DRUG_DRUG_INTERACTION',
          severity: inter.severity,
          message: `Interaction detected between ${inter.drugA} and ${inter.drugB}: ${inter.description}`,
          clinicalAction: inter.clinicalAction
        });
      }
    }

    // Determine Patient Age Group
    let group = 'Adult';
    if (patientAge < 18) group = 'Pediatric';
    else if (patientAge >= 65) group = 'Geriatric';

    // 2. Dose Limits & Safety Profile Checks
    for (const item of items) {
      const name = item.drugName || item.name;
      if (!name) continue;

      // Check Dosage Limits
      const doseRule = await DoseRangeRule.findOne({
        where: { drugName: name, patientGroup: group }
      });

      if (doseRule && item.dailyDoseMg > doseRule.maxDailyDoseMg) {
        requiresHardStop = true;
        alerts.push({
          type: 'DOSAGE_EXCEEDED',
          severity: 'Major',
          message: `Prescribed daily dose ${item.dailyDoseMg}mg of ${name} exceeds maximum safe ${group} dose of ${doseRule.maxDailyDoseMg}mg.`,
          clinicalAction: 'Reduce daily dose below maximum limit.'
        });
      }

      // Check Pregnancy & Renal Profile
      const profile = await DrugSafetyProfile.findOne({ where: { drugName: name } });
      if (profile) {
        if (isPregnant && profile.pregnancyCategory === 'Contraindicated') {
          requiresHardStop = true;
          alerts.push({
            type: 'PREGNANCY_CONTRAINDICATION',
            severity: 'Major',
            message: `${name} is strictly CONTRAINDICATED in pregnancy!`,
            clinicalAction: 'Substitute with a pregnancy-safe alternative.'
          });
        } else if (isPregnant && profile.pregnancyCategory === 'Use with caution') {
          alerts.push({
            type: 'PREGNANCY_WARNING',
            severity: 'Moderate',
            message: `Use ${name} with caution during pregnancy.`,
            clinicalAction: 'Monitor fetal vitals.'
          });
        }

        if (egfr !== null && profile.egfrThreshold && egfr < profile.egfrThreshold) {
          alerts.push({
            type: 'RENAL_DOSAGE_ADJUSTMENT',
            severity: 'Moderate',
            message: `Patient eGFR (${egfr} mL/min) is below threshold (${profile.egfrThreshold}). ${profile.renalAdjustmentAdvice}`,
            clinicalAction: 'Adjust dose according to renal function.'
          });
        }
      }
    }

    return {
      safe: alerts.length === 0,
      requiresHardStop,
      alertCount: alerts.length,
      alerts
    };
  }
}

module.exports = CDSSService;
