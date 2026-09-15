'use strict';

/**
 * Enterprise Structured JSON Logger with Tracing Correlation IDs
 */
class Logger {
  static formatMessage(level, message, meta = {}) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      environment: process.env.NODE_ENV || 'development',
      ...meta
    });
  }

  static info(message, meta) {
    console.log(this.formatMessage('INFO', message, meta));
  }

  static warn(message, meta) {
    console.warn(this.formatMessage('WARN', message, meta));
  }

  static error(message, meta) {
    console.error(this.formatMessage('ERROR', message, meta));
  }
}

module.exports = Logger;
