/**
 * Redis client with graceful degradation.
 * If Redis is unavailable or token is wrong, all operations silently fail
 * and the app falls back to direct MongoDB queries. Core functionality is unaffected.
 */

let redis = null;
const CACHE_TTL = 300; // 5 minutes

// Only initialize Redis if proper credentials are set
const initRedis = () => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token || url.includes('your-') || token === 'your-token') {
    console.warn('⚠️  Redis: No credentials — caching disabled (app still works)');
    return null;
  }

  try {
    const { Redis } = require('@upstash/redis');
    const client = new Redis({ url, token });
    console.log('✅ Redis client initialized');
    return client;
  } catch (e) {
    console.warn('⚠️  Redis: Init failed —', e.message);
    return null;
  }
};

redis = initRedis();

const redisClient = {
  async get(key) {
    if (!redis) return null;
    try {
      const val = await redis.get(key);
      if (val === null || val === undefined) return null;
      // Upstash @upstash/redis auto-parses JSON — handle both cases
      if (typeof val === 'string') {
        try { return JSON.parse(val); } catch { return val; }
      }
      return val;
    } catch (err) {
      if (!err.message?.includes('WRONGPASS')) {
        console.warn('Redis GET error:', err.message);
      }
      return null;
    }
  },

  async set(key, value, ttl = CACHE_TTL) {
    if (!redis) return;
    try {
      // Always serialize to plain JSON string (avoids Mongoose internals being stored)
      const serialized = JSON.stringify(value);
      await redis.set(key, serialized, { ex: ttl });
    } catch (err) {
      if (!err.message?.includes('WRONGPASS')) {
        console.warn('Redis SET error:', err.message);
      }
    }
  },

  async del(key) {
    if (!redis) return;
    try {
      await redis.del(key);
    } catch (err) {
      if (!err.message?.includes('WRONGPASS')) {
        console.warn('Redis DEL error:', err.message);
      }
    }
  },

  // Distributed lock for idempotent settlements
  async acquireLock(lockKey, ttl = 10) {
    if (!redis) return true; // fail-open when no Redis
    try {
      const result = await redis.set(lockKey, '1', { ex: ttl, nx: true });
      return result === 'OK';
    } catch (err) {
      return true; // fail-open
    }
  },

  async releaseLock(lockKey) {
    if (!redis) return;
    try {
      await redis.del(lockKey);
    } catch {
      // ignore
    }
  },
};

module.exports = redisClient;
