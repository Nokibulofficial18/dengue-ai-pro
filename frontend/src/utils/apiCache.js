/**
 * Client-side SWR (Stale-While-Revalidate) Cache Store for DengueAI Pro.
 * Prevents redundant network requests, eliminates blank loading flashes
 * during route transitions, and provides instant (0ms) page renders.
 */
import axios from "axios";

const cacheStore = new Map();
const inFlightRequests = new Map();

// Default cache TTL: 5 minutes
const DEFAULT_TTL_MS = 5 * 60 * 1000;

function createCacheKey(url, config = {}) {
  const paramsStr = config.params ? JSON.stringify(config.params) : "";
  const authKey = config.headers?.["X-Authority-Key"] || config.headers?.Authorization || "";
  return `${url}::${paramsStr}::${authKey}`;
}

/**
 * Synchronously retrieves cached data for immediate component initialization (0ms render).
 */
export function getCached(url, config = {}) {
  const key = createCacheKey(url, config);
  const entry = cacheStore.get(key);
  if (!entry) return null;
  // Return cached data even if expired for stale-while-revalidate
  return entry.data;
}

/**
 * Manually set or update cached data.
 */
export function setCached(url, data, config = {}, ttl = DEFAULT_TTL_MS) {
  const key = createCacheKey(url, config);
  cacheStore.set(key, {
    data,
    timestamp: Date.now(),
    ttl,
  });
}

/**
 * Perform a cached GET request using the Stale-While-Revalidate pattern.
 * - If fresh data is in cache, resolves immediately.
 * - If stale data is in cache, resolves immediately and triggers a background refresh.
 * - Deduplicates concurrent in-flight requests.
 */
export async function cachedGet(url, config = {}, ttl = DEFAULT_TTL_MS, forceRefresh = false) {
  const key = createCacheKey(url, config);
  const entry = cacheStore.get(key);
  const now = Date.now();

  // Fresh cache hit
  if (!forceRefresh && entry && now - entry.timestamp < entry.ttl) {
    return { data: entry.data, fromCache: true };
  }

  // Deduplicate in-flight network request
  if (inFlightRequests.has(key)) {
    const data = await inFlightRequests.get(key);
    return { data, fromCache: false };
  }

  const fetchPromise = axios
    .get(url, config)
    .then((res) => {
      cacheStore.set(key, {
        data: res.data,
        timestamp: Date.now(),
        ttl,
      });
      inFlightRequests.delete(key);
      return res.data;
    })
    .catch((err) => {
      inFlightRequests.delete(key);
      // Fall back to stale cache if network fails
      if (entry) {
        return entry.data;
      }
      throw err;
    });

  inFlightRequests.set(key, fetchPromise);

  // Stale-While-Revalidate: If we have stale cache, return it immediately while fetching in background
  if (!forceRefresh && entry) {
    return { data: entry.data, fromCache: true, isStale: true };
  }

  const freshData = await fetchPromise;
  return { data: freshData, fromCache: false };
}

/**
 * Invalidate cached entries matching a URL prefix or pattern.
 */
export function invalidateCache(urlPrefix = "") {
  if (!urlPrefix) {
    cacheStore.clear();
    return;
  }
  for (const key of cacheStore.keys()) {
    if (key.includes(urlPrefix)) {
      cacheStore.delete(key);
    }
  }
}
