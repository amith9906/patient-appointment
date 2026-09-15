const NodeCache = require('node-cache');

// Standard in-memory cache instance (default TTL: 5 minutes, check period: 2 minutes)
const apiCache = new NodeCache({ stdTTL: 300, checkperiod: 120 });

module.exports = {
  get: (key) => apiCache.get(key),
  set: (key, val, ttlSeconds) => apiCache.set(key, val, ttlSeconds),
  del: (key) => apiCache.del(key),
  flush: () => apiCache.flushAll(),
  
  // Invalidate by key prefix pattern
  invalidatePrefix: (prefix) => {
    const keys = apiCache.keys();
    keys.forEach((key) => {
      if (key.startsWith(prefix)) {
        apiCache.del(key);
      }
    });
  },

  // Express middleware generator for GET caching
  cacheMiddleware: (ttlSeconds = 300, keyPrefix = '') => {
    return (req, res, next) => {
      // Only cache GET requests
      if (req.method !== 'GET') return next();

      // 1. Tenant Isolation: resolve hospital / tenant ID from req context or query
      const tenantId = req.hospitalId || req.user?.hospitalId || (req.query?.hospitalId ? `hosp_${req.query.hospitalId}` : null) || (req.user?.role === 'super_admin' ? 'super_admin' : 'unscoped');

      // 2. User & Role Scoping: isolate responses per user role and user ID
      const userScope = req.user ? `${req.user.role}:${req.user.id}` : 'anon';

      // 3. Full URL + Query Scoping: req.originalUrl contains route path and all query params
      const cacheKey = `${keyPrefix || req.baseUrl}:tenant=${tenantId}:user=${userScope}:${req.originalUrl}`;
      const cachedResponse = apiCache.get(cacheKey);

      if (cachedResponse) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
        return res.send(cachedResponse);
      }

      res.setHeader('X-Cache', 'MISS');

      const originalSend = res.send;
      res.send = function (body) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          apiCache.set(cacheKey, body, ttlSeconds);
        }
        return originalSend.call(this, body);
      };

      next();
    };
  },
};
