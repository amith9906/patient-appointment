const MDMService = require('../services/mdmService');
const { MasterCatalog, CatalogVersion, CatalogSyncJob, Hospital } = require('../models');

describe('Phase 6: Master Data Management (MDM) Test Suite', () => {
  test('publishVersion creates new catalog version and schedules multi-tenant sync jobs', async () => {
    jest.spyOn(MasterCatalog, 'findOne').mockResolvedValue({ id: 1, catalogCode: 'ICD10', update: jest.fn() });
    jest.spyOn(CatalogVersion, 'create').mockResolvedValue({ id: 'uuid-101' });
    jest.spyOn(Hospital, 'findAll').mockResolvedValue([{ id: 1 }, { id: 2 }]);
    jest.spyOn(CatalogSyncJob, 'bulkCreate').mockResolvedValue([]);

    const result = await MDMService.publishVersion({
      catalogCode: 'ICD10',
      version: 'v1.2.0',
      dataPayload: [{ code: 'J00' }],
      userId: 1
    });

    expect(result.catalogVersionId).toBe('uuid-101');
    expect(CatalogSyncJob.bulkCreate).toHaveBeenCalled();

    MasterCatalog.findOne.mockRestore();
    CatalogVersion.create.mockRestore();
    Hospital.findAll.mockRestore();
    CatalogSyncJob.bulkCreate.mockRestore();
  });
});
