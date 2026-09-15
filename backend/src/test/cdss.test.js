const CDSSService = require('../services/cdssService');
const { DrugInteraction, DoseRangeRule, DrugSafetyProfile } = require('../models');
const { initTestDatabase } = require('./setupTestApp');

describe('Phase 3: Clinical Decision Support System (CDSS) Test Suite', () => {
  beforeAll(async () => {
    await initTestDatabase();
  });

  test('evaluatePrescription detects major drug interactions and triggers hard stop', async () => {
    jest.spyOn(DrugInteraction, 'findAll').mockResolvedValue([
      {
        drugA: 'Warfarin',
        drugB: 'Aspirin',
        severity: 'Major',
        description: 'Increased bleeding risk',
        clinicalAction: 'Avoid combination'
      }
    ]);
    jest.spyOn(DoseRangeRule, 'findOne').mockResolvedValue(null);
    jest.spyOn(DrugSafetyProfile, 'findOne').mockResolvedValue(null);

    const result = await CDSSService.evaluatePrescription({
      patientId: 1,
      items: [{ drugName: 'Warfarin' }, { drugName: 'Aspirin' }]
    });

    expect(result.safe).toBe(false);
    expect(result.requiresHardStop).toBe(true);
    expect(result.alerts[0].type).toBe('DRUG_DRUG_INTERACTION');
    expect(result.alerts[0].severity).toBe('Major');

    DrugInteraction.findAll.mockRestore();
    DoseRangeRule.findOne.mockRestore();
    DrugSafetyProfile.findOne.mockRestore();
  });
});
