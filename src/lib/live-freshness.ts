import type { Result } from "./matching";
import { scoreDataset } from "./readiness";
import type { Cadence } from "./types";

export interface LiveMetadata {
  date: string | null;
  publishingFrequency?: string | undefined;
  attribution?: string | undefined;
  license?: string | undefined;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function optionalMetadata(value: unknown): Omit<LiveMetadata, "date"> {
  const body = record(value);
  const details = record(record(body?.customFields)?.["Publishing Details"]);
  return {
    publishingFrequency: text(details?.["Publishing frequency"]),
    attribution: text(body?.attribution),
    license: text(body?.license) ?? text(record(body?.license)?.name),
  };
}

export function normalizePublisherCadence(frequency: string): Cadence | null {
  const normalized = frequency.trim().toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ");
  const synonyms: Record<string, Cadence> = {
    daily: "daily", day: "daily", "every day": "daily", "once a day": "daily",
    hourly: "daily", "every hour": "daily", "multiple times per hour": "daily", "real time": "daily", "continuously": "daily",
    weekly: "weekly", "every week": "weekly",
    monthly: "monthly", "every month": "monthly",
    quarterly: "quarterly", "every quarter": "quarterly",
    annually: "annual", annual: "annual", yearly: "annual", "every year": "annual",
    static: "static", "one time": "static", "not updated": "frozen", frozen: "frozen",
  };
  return synonyms[normalized] ?? null;
}

export function cadenceNote(cadence: Cadence, frequency?: string): string | null {
  if (!frequency?.trim()) return null;
  return normalizePublisherCadence(frequency) === cadence ? "cadence confirmed by publisher" : `publisher states ${frequency}`;
}

export function metadataLicenses(metadata: ReadonlyMap<string, LiveMetadata | null>, ids: readonly string[]): string[] {
  return [...new Set(ids.flatMap(id => {
    const license = metadata.get(id)?.license;
    return license ? [license] : [];
  }))];
}

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

async function fetchLiveMetadata(id: string): Promise<LiveMetadata | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LIVE_TIMEOUT_MS);
  let primary: LiveMetadata | null = null;
  try {
    try {
      const response = await fetch(`https://data.sf.gov/api/views/metadata/v1/${encodeURIComponent(id)}`, { signal: controller.signal });
      if (response.ok) {
        const body = await response.json();
        primary = { ...optionalMetadata(body), date: metadataDate(record(body)?.dataUpdatedAt) };
        if (primary.date) return primary;
      }
    } catch { /* Try the legacy endpoint if the shared deadline has not expired. */ }
    if (controller.signal.aborted) return primary;
    try {
      const response = await fetch(`https://data.sf.gov/api/views/${encodeURIComponent(id)}.json`, { signal: controller.signal });
      if (!response.ok) return primary;
      const body = await response.json();
      const date = legacyDate(record(body)?.rowsUpdatedAt);
      const fallback = optionalMetadata(body);
      if (!date && !primary && !Object.values(fallback).some(Boolean)) return null;
      return {
        date,
        publishingFrequency: primary?.publishingFrequency ?? fallback.publishingFrequency,
        attribution: primary?.attribution ?? fallback.attribution,
        license: primary?.license ?? fallback.license,
      };
    } catch { return primary; }
  } catch { return primary; }
  finally { clearTimeout(timeout); }
}

/** Each dataset has one cached check (including its fallback) per page session. */
export function createFreshnessChecker(check: (id: string) => Promise<LiveMetadata | null> = fetchLiveMetadata) {
  const cache = new Map<string, Promise<LiveMetadata | null>>();
  const queue: Array<() => void> = [];
  let active = 0;
  const drain = () => {
    while (active < LIVE_CONCURRENCY && queue.length > 0) queue.shift()?.();
  };
  return (id: string): Promise<LiveMetadata | null> => {
    const cached = cache.get(id);
    if (cached) return cached;
    let resolveDate: (metadata: LiveMetadata | null) => void = () => {};
    const promise = new Promise<LiveMetadata | null>(resolve => { resolveDate = resolve; });
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

let checkedMetadata: ReadonlyMap<string, LiveMetadata | null> = new Map();
const listeners = new Set<() => void>();
export const subscribeMetadata = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getCheckedMetadata = () => checkedMetadata;
const emptyMetadata: ReadonlyMap<string, LiveMetadata | null> = new Map();
export const getServerMetadata = () => emptyMetadata;
export const checkFreshness = createFreshnessChecker(async id => {
  const metadata = await fetchLiveMetadata(id);
  checkedMetadata = new Map(checkedMetadata).set(id, metadata);
  listeners.forEach(listener => listener());
  return metadata;
});