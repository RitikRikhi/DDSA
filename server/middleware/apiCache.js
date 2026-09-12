/**
 * In-memory high-speed cache for read-heavy API responses.
 * Reduces database/disk overhead and provides sub-millisecond responses.
 */

const cacheStore = new Map();

function apiCache(durationSeconds = 60) {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const key = req.originalUrl || req.url;
    const cached = cacheStore.get(key);

    if (cached && (Date.now() - cached.timestamp < durationSeconds * 1000)) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Cache-Control', `public, max-age=${durationSeconds}`);
      return res.json(cached.data);
    }

    // Intercept res.json to capture response
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode === 200) {
        cacheStore.set(key, {
          timestamp: Date.now(),
          data: body
        });
      }
      res.setHeader('X-Cache', 'MISS');
      return originalJson(body);
    };

    next();
  };
}

function clearApiCache(prefix = '') {
  if (!prefix) {
    cacheStore.clear();
    return;
  }
  for (const key of cacheStore.keys()) {
    if (key.startsWith(prefix)) {
      cacheStore.delete(key);
    }
  }
}

module.exports = {
  apiCache,
  clearApiCache
};
