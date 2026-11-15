import { afterEach, describe, expect, it, vi } from "vitest";
import catalog from "@/data/catalog.json";
import type { Catalog } from "@/lib/types";
import { search } from "@/lib/search";
import { scoreDataset } from "@/lib/readiness";
import { applyLiveFreshness, cadenceNote, createFreshnessChecker, legacyDate, metadataDate, metadataLicenses, optionalMetadata, type LiveMetadata } from "@/lib/live-freshness";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const stored = search(catalog as Catalog, "where have restaurants been closing").results[0];
if (!stored) throw new Error("Acceptance result is missing");
const result = stored;

describe("Live date rules", () => {
  it("parses ISO metadata strings as UTC calendar dates, not seconds", () => {
    expect(metadataDate("2026-11-14T11:41:59+0000")).toBe("2026-11-14");
    expect(metadataDate("2026-11-14T23:41:59-0200")).toBe("2026-11-15");
    expect(metadataDate(1794656519)).toBeNull();
    expect(metadataDate(undefined)).toBeNull();
  });
  it("parses legacy rowsUpdatedAt as Unix seconds only", () => {
    expect(legacyDate(Date.parse("2026-11-14T11:41:59Z") / 1000)).toBe("2026-11-14");
    expect(legacyDate("2026-11-14T11:41:59+0000")).toBeNull();
  });
  it("marks an equal live date as verified without changing the result", () => {
    expect(applyLiveFreshness(result, result.dataset.last_updated)).toEqual({ result, status: "verified live" });
  });
  it("uses a newer date on a copy and delegates that dataset's recomputation", () => {
    const live = applyLiveFreshness(result, "2026-11-15");
    expect(live.status).toBe("updated since snapshot");
    expect(live.result.dataset.last_updated).toBe("2026-11-15");
    expect(live.result.score).toEqual(scoreDataset({ ...result.dataset, last_updated: "2026-11-15" }, "2026-11-15"));
    expect(result.dataset.last_updated).toBe("2026-11-14");
  });
  it("keeps the snapshot for an older live date", () => {
    expect(applyLiveFreshness(result, "2026-11-13")).toEqual({ result, status: "snapshot" });
  });
  it("keeps the snapshot on a failed check", () => {
    expect(applyLiveFreshness(result, null)).toEqual({ result, status: "snapshot" });
  });
});

describe("Public endpoint checks", () => {
  it("uses dataUpdatedAt from the primary endpoint", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ dataUpdatedAt: "2026-11-14T11:41:59+0000" })));
    vi.stubGlobal("fetch", fetcher);
    expect((await createFreshnessChecker()("vw6y-z8j6"))?.date).toBe("2026-11-14");
    expect(fetcher.mock.calls[0]?.[0]).toBe("https://data.sf.gov/api/views/metadata/v1/vw6y-z8j6");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("falls back to rowsUpdatedAt on a primary error, ignoring dataUpdatedAt there", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response("", { status: 500 })).mockResolvedValueOnce(new Response(JSON.stringify({ rowsUpdatedAt: Date.parse("2026-11-15T01:00:00Z") / 1000, dataUpdatedAt: "2000-01-01T00:00:00Z" })));
    vi.stubGlobal("fetch", fetcher);
    expect((await createFreshnessChecker()("vw6y-z8j6"))?.date).toBe("2026-11-15");
    expect(fetcher.mock.calls[1]?.[0]).toBe("https://data.sf.gov/api/views/vw6y-z8j6.json");
  });
  it("rejects a legacy response lacking rowsUpdatedAt instead of falsely verifying", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("", { status: 500 })).mockResolvedValueOnce(new Response(JSON.stringify({ dataUpdatedAt: "2026-11-14T11:41:59+0000" }))));
    expect(await createFreshnessChecker()("vw6y-z8j6")).toBeNull();
  });
  it("degrades safely on rate limits", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response("", { status: 429 })));
    expect(await createFreshnessChecker()("vw6y-z8j6")).toBeNull();
  });
  it("degrades safely on CORS or network rejection", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    expect(await createFreshnessChecker()("vw6y-z8j6")).toBeNull();
  });
  it("aborts after exactly six seconds without beginning another request", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const fetcher = vi.fn((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
      signal = options.signal ?? undefined;
      signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));
    vi.stubGlobal("fetch", fetcher);
    const check = createFreshnessChecker()("vw6y-z8j6");
    await vi.advanceTimersByTimeAsync(5999);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(signal?.aborted).toBe(true);
    expect(await check).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("Session queue", () => {
  it("caches each id once including failed checks", async () => {
    const request = vi.fn().mockRejectedValue(new Error("offline"));
    const checker = createFreshnessChecker(request);
    const first = checker("vw6y-z8j6");
    expect(checker("vw6y-z8j6")).toBe(first);
    expect(await first).toBeNull();
    expect(await checker("vw6y-z8j6")).toBeNull();
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("limits active checks to six and drains the queue", async () => {
    const releases: Array<(value: LiveMetadata | null) => void> = [];
    const request = vi.fn(() => new Promise<LiveMetadata | null>(resolve => releases.push(resolve)));
    const checker = createFreshnessChecker(request);
    const promises = Array.from({ length: 8 }, (_, i) => checker(String(i)));
    expect(request).toHaveBeenCalledTimes(6);
    releases[0]?.(null);
    await promises[0];
    expect(request).toHaveBeenCalledTimes(7);
    releases[1]?.(null);
    await promises[1];
    expect(request).toHaveBeenCalledTimes(8);
    releases.slice(2).forEach(resolve => resolve(null));
    expect(await Promise.all(promises)).toEqual(Array(8).fill(null));
  });
});

describe("Optional publisher metadata", () => {
  it("reads the three optional fields from the same cached request", async () => {
    const license = "Open Data Commons Public Domain Dedication and License";
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      dataUpdatedAt: "2026-11-14T11:41:59+0000",
      customFields: { "Publishing Details": { "Publishing frequency": "Daily" } },
      attribution: "San Francisco 311", license,
    })));
    vi.stubGlobal("fetch", fetcher);
    const checker = createFreshnessChecker();
    expect(await checker("vw6y-z8j6")).toEqual({ date: "2026-11-14", publishingFrequency: "Daily", attribution: "San Francisco 311", license });
    await checker("vw6y-z8j6");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("safely ignores missing, blank, and malformed optional fields", () => {
    for (const body of [null, undefined, {}, { customFields: null }, { customFields: { "Publishing Details": null } }, { customFields: 7, attribution: 42, license: " " }]) {
      expect(optionalMetadata(body)).toEqual({ publishingFrequency: undefined, attribution: undefined, license: undefined });
    }
    expect(cadenceNote("daily", undefined)).toBeNull();
    expect(cadenceNote("daily", " ")).toBeNull();
  });
  it.each([
    ["daily", "Daily"], ["daily", "daily"], ["annual", "Annually"], ["annual", "annual"],
    ["quarterly", "Quarterly"], ["quarterly", "quarterly"], ["daily", "Multiple times per hour"],
  ] as const)("confirms %s against publisher %s", (cadence, frequency) => {
    // Assert the actual agreement rule, not its display wording.
    expect(cadenceNote(cadence, frequency)).toBe(cadenceNote(cadence, cadence));
    expect(cadenceNote(cadence, frequency)).not.toBeNull();
    expect(cadenceNote(cadence, frequency)).not.toBe(cadenceNote(cadence === "daily" ? "annual" : "daily", frequency));
  });
  it("preserves the publisher's disagreement and never changes cadence or score", async () => {
    const before = structuredClone(result);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      dataUpdatedAt: `${result.dataset.last_updated}T11:41:59+0000`,
      customFields: { "Publishing Details": { "Publishing frequency": "Quarterly" } },
    }))));
    const metadata = await createFreshnessChecker()(result.dataset.id);
    expect(metadata?.publishingFrequency).toBe("Quarterly");
    expect(cadenceNote(result.dataset.cadence, metadata?.publishingFrequency)).not.toBe(cadenceNote("quarterly", "Quarterly"));
    expect(applyLiveFreshness(result, metadata?.date ?? null).result.score).toEqual(before.score);
    expect(result.dataset.cadence).toBe(before.dataset.cadence);
    expect(result).toEqual(before);
  });
  it("retains available optional fields even when the date is missing and fallback fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ attribution: "San Francisco 311" }))).mockRejectedValueOnce(new TypeError("offline")));
    expect(await createFreshnessChecker()("vw6y-z8j6")).toMatchObject({ date: null, attribution: "San Francisco 311" });
  });
  it("reads optional fields from the fallback without mixing date formats", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new TypeError("offline")).mockResolvedValueOnce(new Response(JSON.stringify({
      rowsUpdatedAt: Date.parse("2026-11-14T11:41:59Z") / 1000,
      customFields: { "Publishing Details": { "Publishing frequency": "Daily" } },
      attribution: "San Francisco 311", license: { name: "Public Domain" },
    }))));
    expect(await createFreshnessChecker()("vw6y-z8j6")).toEqual({ date: "2026-11-14", publishingFrequency: "Daily", attribution: "San Francisco 311", license: "Public Domain" });
  });
  it("deduplicates licenses for current search results and omits absent licenses", () => {
    const metadata = new Map<string, LiveMetadata | null>([
      ["a", { date: null, license: "Public Domain" }], ["b", { date: null, license: "Public Domain" }],
      ["c", { date: null }], ["d", { date: null, license: "Another license" }], ["e", null],
    ]);
    expect(metadataLicenses(metadata, ["a", "b", "c", "e", "missing"])).toEqual(["Public Domain"]);
    expect(metadataLicenses(metadata, [])).toEqual([]);
  });
});