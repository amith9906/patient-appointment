const GlobalSearchService = require('../services/globalSearchService');
const { sequelize } = require('../models');

describe('Phase 4: Universal Enterprise Search Platform Test Suite', () => {
  beforeAll(async () => {
    // Mock raw query execution for SQLite test environment compatibility
    jest.spyOn(sequelize, 'query').mockImplementation(async (sql) => {
      if (sql.includes('global_search_index')) {
        return [[{ entity_type: 'Patient', entity_id: '1', title: 'Ramesh Kumar', subtitle: 'UHID-998877' }]];
      }
      return [[]];
    });
  });

  afterAll(() => {
    sequelize.query.mockRestore();
  });

  test('GlobalSearchService returns search results within 500ms benchmark limit', async () => {
    const start = Date.now();
    const results = await GlobalSearchService.search({ q: 'Ramesh', hospitalId: 1 });
    const tookMs = Date.now() - start;

    expect(tookMs).toBeLessThan(500);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe('Ramesh Kumar');
  });
});
