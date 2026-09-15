const MetricsService = require('../services/metricsService');

describe('Phase 9: Observability Platform Test Suite', () => {
  test('getMetrics collects heap memory, uptime, and system load averages', () => {
    const metrics = MetricsService.getMetrics();
    expect(metrics).toHaveProperty('uptimeSeconds');
    expect(metrics.memory).toHaveProperty('heapUsedMb');
    expect(metrics.system).toHaveProperty('cpuLoadAvg');
  });

  test('checkLiveness returns ALIVE status', () => {
    const live = MetricsService.checkLiveness();
    expect(live.status).toBe('ALIVE');
  });
});
