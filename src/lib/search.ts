// Buildable — ranking and adjacent suggestions.

import type { Catalog, Dataset } from "./types";
import { scoreDataset } from "./readiness";
import { analyseQuery, matchDataset, FIT_THRESHOLD, MAX_RESULTS, type QueryAnalysis, type Result } from "./matching";
import { BASE_LAYER_REASONS, DOMAIN_LABEL } from "./vocab";

export function search(catalog: Catalog, query: string): { analysis: QueryAnalysis; results: Result[] } {
  const analysis = analyseQuery(query);
  const results = catalog.datasets
    .map((dataset) => ({
      dataset,
      match: matchDataset(dataset, analysis),
      score: scoreDataset(dataset, catalog.snapshot_date),
    }))
    .filter((r) => r.match.fit > FIT_THRESHOLD)
    .sort((a, b) => b.match.fit - a.match.fit || b.score.total - a.score.total)
    .slice(0, MAX_RESULTS);
  return { analysis, results };
}

export interface Suggestion { dataset: Dataset; reason: string; score: ReturnType<typeof scoreDataset> }

export function suggestAdjacent(catalog: Catalog, query: string, shown: Result[]): Suggestion[] {
  const analysis = analyseQuery(query);
  const shownIds = new Set(shown.slice(0, 6).map((r) => r.dataset.id));
  const topDomains = new Set(shown.slice(0, 4).flatMap((r) => r.dataset.domains));

  const picks: Suggestion[] = [];
  const add = (dataset: Dataset, reason: string): void => {
    if (shownIds.has(dataset.id) || picks.some((p) => p.dataset.id === dataset.id)) return;
    picks.push({ dataset, reason, score: scoreDataset(dataset, catalog.snapshot_date) });
  };

  // Base layers: worth surfacing whenever the sentence implies anything geographic.
  const wantsGeo = Boolean(analysis.intents.map || analysis.domains.geo || analysis.domains.housing || analysis.domains.transit);
  if (wantsGeo) {
    for (const [id, reason] of Object.entries(BASE_LAYER_REASONS)) {
      const d = catalog.datasets.find((x) => x.id === id);
      if (d) add(d, reason);
      if (picks.length >= 2) break;
    }
  }

  // Near misses: scored, but below the fold.
  const ranked = catalog.datasets
    .map((dataset) => ({ dataset, match: matchDataset(dataset, analysis), score: scoreDataset(dataset, catalog.snapshot_date) }))
    .filter((r) => r.match.fit > 0.4)
    .sort((a, b) => b.match.fit - a.match.fit);

  for (const r of ranked.slice(6, 16)) {
    if (picks.length >= 5) break;
    const shared = r.dataset.domains.find((dom) => topDomains.has(dom));
    if (shared) {
      add(r.dataset, `Sits in the same ${DOMAIN_LABEL[shared] ?? shared} space as your top results — worth a look if your angle shifts.`);
    }
  }

  // One cautionary tale: a plausible-looking dataset that cannot carry a build.
  const trap = ranked.find((r) => r.score.label === "none" && !shownIds.has(r.dataset.id));
  if (trap && picks.length < 5) {
    add(trap.dataset, "Looks relevant and gets suggested a lot, but it is not usable for a new build — worth knowing so you do not lose an hour to it.");
  }
  return picks.slice(0, 5);
}
