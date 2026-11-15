import type { Result } from "./matching";
import { scoreDataset } from "./readiness";

export type FreshnessStatus = "snapshot" | "verified live" | "updated since snapshot";
export const LIVE_TIMEOUT_MS = 6000;
export const LIVE_CONCURRENCY = 6;

export function metadataDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}

export function legacyDate(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const date = new Date(value * 1000);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}

export function applyLiveFreshness(result: Result, date: string | null): { result: Result; status: FreshnessStatus } {
  if (!date || date < result.dataset.last_updated) return { result, status: "snapshot" };
  if (date === result.dataset.last_updated) return { result, status: "verified live" };
  const dataset = { ...result.dataset, last_updated: date };
  return { result: { ...result, dataset, score: scoreDataset(dataset, date) }, status: "updated since snapshot" };
}

async function fetchLiveDate(id: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LIVE_TIMEOUT_MS);
  try {
    try {
      const response = await fetch(`https://data.sf.gov/api/views/metadata/v1/${encodeURIComponent(id)}`, { signal: controller.signal });
      if (response.ok) {
        const body = await response.json();
        const date = metadataDate(body?.dataUpdatedAt);
        if (date) return date;
      }
    } catch { /* Try the legacy endpoint if the shared deadline has not expired. */ }
    if (controller.signal.aborted) return null;
    try {
      const response = await fetch(`https://data.sf.gov/api/views/${encodeURIComponent(id)}.json`, { signal: controller.signal });
      if (!response.ok) return null;
      const body = await response.json();
      return legacyDate(body?.rowsUpdatedAt);
    } catch { return null; }
  } catch { return null; }
  finally { clearTimeout(timeout); }
}

/** Each dataset has one cached check (including its fallback) per page session. */
export function createFreshnessChecker(check: (id: string) => Promise<string | null> = fetchLiveDate) {
  const cache = new Map<string, Promise<string | null>>();
  const queue: Array<() => void> = [];
  let active = 0;
  const drain = () => {
    while (active < LIVE_CONCURRENCY && queue.length > 0) queue.shift()?.();
  };
  return (id: string): Promise<string | null> => {
    const cached = cache.get(id);
    if (cached) return cached;
    let resolveDate: (date: string | null) => void = () => {};
    const promise = new Promise<string | null>(resolve => { resolveDate = resolve; });
    cache.set(id, promise);
    queue.push(() => {
      active++;
      void (async () => {
        try { resolveDate(await check(id)); }
        catch { resolveDate(null); }
        finally { active--; drain(); }
      })();
    });
    drain();
    return promise;
  };
}

export const checkFreshness = createFreshnessChecker();