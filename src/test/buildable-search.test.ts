import { describe, expect, it } from "vitest";
import catalog from "@/data/catalog.json";
import type { Catalog } from "@/lib/types";
import { search } from "@/lib/search";

describe("Restaurant closure acceptance", () => {
  const { results } = search(catalog as Catalog, "where have restaurants been closing");
  it("ranks Registered Business Locations first and ready", () => {
    expect(results[0]?.dataset.name).toBe("Registered Business Locations - San Francisco");
    expect(results[0]?.score.label).toBe("ready");
  });
  it("includes retired inspections as unavailable with the hard gate", () => {
    const inspections = results.find(({ dataset }) => dataset.name === "Health Inspection Scores (2016-2019)");
    expect(inspections?.score.label).toBe("none");
    expect(inspections?.score.hardGateApplied).toBe(true);
    expect(inspections?.score.total).toBe(45);
  });
});