type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

export function createTtlCache(ttlMs: number) {
  const store = new Map<string, CacheEntry<unknown>>();

  return {
    get<T>(key: string): T | undefined {
      const hit = store.get(key) as CacheEntry<T> | undefined;
      if (!hit) return undefined;
      if (hit.expiresAt <= Date.now()) {
        store.delete(key);
        return undefined;
      }
      return hit.value;
    },
    set<T>(key: string, value: T): T {
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    },
    clear() {
      store.clear();
    },
  };
}

export function cacheKey(path: string, params: Record<string, string | number | boolean | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${String(v)}`);
  return `${path}?${parts.join("&")}`;
}
