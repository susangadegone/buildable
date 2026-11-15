import { describe, expect, it } from "vitest";
import catalog from "@/data/catalog.json";
import type { Catalog } from "@/lib/types";
import { search } from "@/lib/search";
import { resultCounts, visibleResults } from "@/components/results-browser";

const results = search(catalog as Catalog, "where have restaurants been closing").results;
describe("Result presentation rules", () => {
  it("counts labels from all 14 matches", () => {
    expect(resultCounts(results)).toEqual({ all: 14, ready: 10, work: 3, none: 1 });
  });
  it("filters by readiness without changing the full results", () => {
    const filtered = visibleResults(results, "none", "fit");
    expect(filtered.map(r => r.dataset.name)).toEqual(["Health Inspection Scores (2016-2019)"]);
    expect(results).toHaveLength(14);
  });
  it("preserves the exact search order for best fit", () => {
    expect(visibleResults(results, "all", "fit").map(r => r.dataset.id)).toEqual(results.map(r => r.dataset.id));
  });
  it("sorts readiness descending without mutating search order", () => {
    const sorted = visibleResults(results, "all", "readiness");
    expect(sorted.map(r => r.score.total)).toEqual(results.map(r => r.score.total).sort((a, b) => b - a));
    expect(results[0]?.dataset.name).toBe("Registered Business Locations - San Francisco");
  });
  it("sorts most recently updated by days since update ascending", () => {
    expect(visibleResults(results, "all", "updated").map(r => r.score.daysSinceUpdate)).toEqual(results.map(r => r.score.daysSinceUpdate).sort((a, b) => a - b));
  });
});