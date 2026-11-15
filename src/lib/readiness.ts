// Buildable — readiness rubric.
// Pure functions only. No UI, no fetch, no Date.now().

import type { Cadence, Dataset, LabelKey, Score } from "./types";

/** How stale a dataset of each cadence is allowed to get before it looks neglected. */
const CADENCE_TOLERANCE_DAYS: Record<Cadence, number> = {
  daily: 7, weekly: 21, monthly: 60, quarterly: 180, annual: 450,
  static: Number.POSITIVE_INFINITY,
  frozen: -1, // handled separately; never used in arithmetic
};

export const CADENCE_LABEL: Record<Cadence, string> = {
  daily: "Daily", weekly: "Weekly", monthly: "Monthly", quarterly: "Quarterly",
  annual: "Annual", static: "Static / rarely changes", frozen: "Stopped updating",
};

/** Reads correctly inside "it updates ___, so ...". */
export const CADENCE_ADVERB: Record<Cadence, string> = {
  daily: "daily", weekly: "weekly", monthly: "monthly", quarterly: "quarterly",
  annual: "once a year", static: "only rarely", frozen: "never any more",
};

export const GEOMETRY_LABEL = {
  point: "Point coordinates", line: "Lines", polygon: "Polygons", none: "No geometry",
} as const;

export const GRAIN_LABEL = {
  row: "One row per event", join: "Needs a join", agg: "Pre-aggregated", ref: "Reference layer",
} as const;

export const LABEL_TEXT: Record<LabelKey, string> = {
  ready: "Ready to build", work: "Usable with work", none: "Not available yet",
};

/** Icon accompanies every label. Colour alone must never carry the meaning. */
export const LABEL_ICON: Record<LabelKey, string> = {
  ready: "●", work: "◑", none: "○",
};

export const LABEL_COLOR: Record<LabelKey, string> = {
  ready: "#0ca30c", work: "#fab219", none: "#d03b3b",
};

/**
 * Whole days between two YYYY-MM-DD dates.
 * Both are pinned to 12:00 UTC: parsing a bare date as local time shifts it by a
 * day either side of UTC and silently moves scores across thresholds.
 */
export function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso + "T12:00:00Z").getTime();
  const b = new Date(toIso + "T12:00:00Z").getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/**
 * Score one dataset out of 100.
 * `snapshotDate` must be the catalogue's own snapshot_date — never today's date,
 * or every score drifts and the demo stops matching what was rehearsed.
 */
export function scoreDataset(d: Dataset, snapshotDate: string): Score {
  const daysSinceUpdate = daysBetween(d.last_updated, snapshotDate);

  // FRESHNESS — 35. Staleness judged against this dataset's own expected rhythm.
  let freshness: number;
  let freshnessWhy: string;
  if (d.cadence === "frozen") {
    freshness = 0;
    freshnessWhy = "has stopped updating";
  } else {
    const tolerance = CADENCE_TOLERANCE_DAYS[d.cadence];
    if (tolerance === Number.POSITIVE_INFINITY) {
      freshness = 35;
      freshnessWhy = "not expected to change often";
    } else {
      const ratio = daysSinceUpdate / tolerance;
      if (ratio <= 1)        { freshness = 35; freshnessWhy = "on schedule"; }
      else if (ratio <= 1.5) { freshness = 26; freshnessWhy = "slightly behind schedule"; }
      else if (ratio <= 3)   { freshness = 15; freshnessWhy = "well behind schedule"; }
      else if (ratio <= 6)   { freshness = 7;  freshnessWhy = "long overdue"; }
      else                   { freshness = 3;  freshnessWhy = "effectively abandoned"; }
    }
  }

  // ACCESS — 25. Can code reach it right now, without a key?
  const access = d.access === "api" ? 25 : d.access === "dashboard" ? 10 : 8;
  const accessWhy =
    d.access === "api" ? "open API, no key needed"
    : d.access === "dashboard" ? "published as a dashboard"
    : "data locked in a file attachment";

  // GRANULARITY — 20. One row per real event, with geometry, is the useful shape.
  let granularity: number;
  let granularityWhy: string;
  if (d.grain === "row") {
    if (d.geometry !== "none") { granularity = 20; granularityWhy = "row-level with geometry"; }
    else                       { granularity = 11; granularityWhy = "row-level, no coordinates"; }
  } else if (d.grain === "join") { granularity = 6; granularityWhy = "only useful after a join"; }
  else if (d.grain === "agg")    { granularity = 6; granularityWhy = "pre-aggregated"; }
  else                           { granularity = 8; granularityWhy = "reference layer"; }

  // STABILITY — 20. Each documented trap costs points.
  const n = d.caveats.length;
  const stability = d.superseded ? 0 : n === 0 ? 20 : n === 1 ? 13 : n === 2 ? 8 : 4;
  const stabilityWhy =
    d.superseded ? "replaced by another dataset"
    : n === 0 ? "no documented traps"
    : `${n} documented ${n === 1 ? "catch" : "catches"}`;

  // HARD GATE — you cannot ship something current on data that stopped.
  let total = freshness + access + granularity + stability;
  let hardGateApplied = false;
  if ((d.cadence === "frozen" || d.superseded) && total > 45) {
    total = 45;
    hardGateApplied = true;
  }

  const label: LabelKey = total >= 80 ? "ready" : total >= 50 ? "work" : "none";

  return {
    freshness, access, granularity, stability, total, label, hardGateApplied, daysSinceUpdate,
    why: { freshness: freshnessWhy, access: accessWhy, granularity: granularityWhy, stability: stabilityWhy },
  };
}

/** Capability flags the matcher uses to reward or penalise a dataset against an intent. */
export function capabilities(d: Dataset) {
  return {
    canMap:     d.geometry !== "none",
    canTrend:   d.grain === "row" || d.grain === "agg",
    isLive:     d.cadence === "daily",
    canJoin:    d.grain === "row" || d.grain === "join" || d.grain === "ref",
    highVolume: (d.rows ?? 0) > 200_000,
  };
}

export function formatRows(n: number | null): string | null {
  if (n == null) return null;
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return Math.round(n / 1_000) + "k";
  return String(n);
}
