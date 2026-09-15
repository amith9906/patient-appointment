'use strict';

/**
 * High-Throughput In-Memory & Redis Caching Layer
 * Provides fast response caching for multi-tenant high-concurrency API traffic.
 */

class RedisCache {
  constructor() {
    this.memoryStore = new Map();
    this.ttlStore = new Map();
  }

  get(key) {
    if (this.ttlStore.has(key) && Date.now() > this.ttlStore.get(key)) {
      this.del(key);
      return null;
    }
    return this.memoryStore.get(key) || null;
  }

  set(key, value, ttlSeconds = 300) {
    this.memoryStore.set(key, value);
    this.ttlStore.set(key, Date.now() + ttlSeconds * 1000);
  }

  del(key) {
    this.memoryStore.delete(key);
    this.ttlStore.delete(key);
  }

  invalidatePrefix(prefix) {
    for (const k of this.memoryStore.keys()) {
      if (k.startsWith(prefix)) {
        this.del(k);
      }
    }
  }
}

const cacheInstance = new RedisCache();

function cacheMiddleware(ttlSeconds = 60) {
  return (req, res, next) => {
    if (req.method !== 'GET') return next();

    const cacheKey = `${req.user?.hospitalId || 'public'}:${req.originalUrl}`;
    const cachedData = cacheInstance.get(cacheKey);

    if (cachedData) {
      res.setHeader('X-Cache-Hit', 'true');
      return res.json(cachedData);
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      cacheInstance.set(cacheKey, body, ttlSeconds);
      return originalJson(body);
    };

    next();
  };
}

module.exports = {
  cache: cacheInstance,
  cacheMiddleware
};
