'use strict';

const os = require('os');
const { sequelize } = require('../models');

class MetricsService {
  static getMetrics() {
    const memoryUsage = process.memoryUsage();
    return {
      uptimeSeconds: process.uptime(),
      memory: {
        rssMb: (memoryUsage.rss / 1024 / 1024).toFixed(2),
        heapTotalMb: (memoryUsage.heapTotal / 1024 / 1024).toFixed(2),
        heapUsedMb: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2)
      },
      system: {
        cpuLoadAvg: os.loadavg(),
        freeMemMb: (os.freemem() / 1024 / 1024).toFixed(2),
        totalMemMb: (os.totalmem() / 1024 / 1024).toFixed(2)
      },
      timestamp: new Date().toISOString()
    };
  }

  static async checkReadiness() {
    try {
      await sequelize.authenticate();
      return { status: 'READY', dbConnection: 'OK' };
    } catch (err) {
      return { status: 'NOT_READY', dbConnection: 'FAILED', error: err.message };
    }
  }

  static checkLiveness() {
    return { status: 'ALIVE', timestamp: new Date().toISOString() };
  }
}

module.exports = MetricsService;
