// Buildable — verification gate. Run this immediately after wiring the rubric.
// It proves the implementation is correct before any UI exists, by checking the
// recomputed score of all 74 datasets against the values stored in the catalogue.

import { readFileSync } from "node:fs";
import type { Catalog } from "./types";
import { scoreDataset, LABEL_TEXT } from "./readiness";
import { search } from "./search";

const catalog = JSON.parse(readFileSync("../sf-dataset-catalog.json", "utf8")) as Catalog;

let failures = 0;
const fail = (msg: string): void => { failures++; console.log("  FAIL  " + msg); };

// --- 1. Rubric oracle: recomputed scores must equal the stored ones, exactly.
for (const d of catalog.datasets) {
  const s = scoreDataset(d, catalog.snapshot_date);
  const e = d.readiness;
  if (s.total !== e.score)            fail(`${d.id} total ${s.total} != stored ${e.score}`);
  if (s.label !== e.key)              fail(`${d.id} label ${s.label} != stored ${e.key}`);
  if (s.freshness !== e.freshness)    fail(`${d.id} freshness ${s.freshness} != ${e.freshness}`);
  if (s.access !== e.access)          fail(`${d.id} access ${s.access} != ${e.access}`);
  if (s.granularity !== e.granularity) fail(`${d.id} granularity ${s.granularity} != ${e.granularity}`);
  if (s.stability !== e.stability)    fail(`${d.id} stability ${s.stability} != ${e.stability}`);
  if (s.hardGateApplied !== e.hard_gate_applied) fail(`${d.id} hard gate ${s.hardGateApplied} != ${e.hard_gate_applied}`);
}
console.log(`rubric oracle: ${catalog.datasets.length} datasets checked`);

// --- 2. Integer discipline: a fractional score can straddle a threshold.
for (const d of catalog.datasets) {
  const s = scoreDataset(d, catalog.snapshot_date);
  if (!Number.isInteger(s.total)) fail(`${d.id} total is not an integer: ${s.total}`);
}

// --- 3. The demo sentences must rank the expected dataset first.
const expectations: Array<[string, string]> = [
  ["A map showing renters which blocks have the most eviction notices filed", "5cei-gny5"],
  ["where have restaurants been closing", "g8m3-pdis"],
  ["A tool that warns cyclists about the most dangerous intersections on their commute", "ubvf-ztfx"],
  ["live map of where food trucks are parked right now", "rqzj-sfat"],
  ["Help people find the nearest public restroom and drinking fountain", "wfq4-upmv"],
  ["Predict which buildings are most at risk in an earthquake", "beah-shgi"],
  ["something about city salaries and overtime", "88g8-5mnd"],
  ["live alerts when a street near me gets a tow zone", "6r5h-j298"],
];
for (const [q, expectedId] of expectations) {
  const { results } = search(catalog, q);
  const got = results[0]?.dataset.id;
  if (got !== expectedId) {
    fail(`"${q}"\n          expected #1 ${expectedId}, got ${got ?? "no results"}`);
  }
}
console.log(`demo sentences: ${expectations.length} checked`);

// --- 4. The restaurant reveal: the dead dataset must appear AND be labelled red.
const closing = search(catalog, "where have restaurants been closing");
const dead = closing.results.find((r) => r.dataset.id === "pyih-qa8i");
if (!dead) fail("pyih-qa8i (dead inspections) missing from the restaurant query — the demo reveal breaks");
else if (dead.score.label !== "none") fail(`pyih-qa8i labelled ${dead.score.label}, expected none`);
else if (!dead.score.hardGateApplied) fail("pyih-qa8i should have the hard gate applied");

// --- 5. No query may throw, including adversarial input.
for (const q of ["", "a", "311", "qqq zzz", "!!!", "a".repeat(5000), "map map map map"]) {
  try { search(catalog, q); } catch (err) { fail(`search threw on ${JSON.stringify(q.slice(0, 20))}: ${String(err)}`); }
}

// --- 6. Snapshot date must never be "now".
if (!/^\d{4}-\d{2}-\d{2}$/.test(catalog.snapshot_date)) fail("snapshot_date is not a plain YYYY-MM-DD date");

console.log("");
if (failures === 0) {
  const dist = { ready: 0, work: 0, none: 0 } as Record<string, number>;
  catalog.datasets.forEach((d) => { dist[scoreDataset(d, catalog.snapshot_date).label]++; });
  console.log("ALL CHECKS PASSED");
  console.log(`distribution: ${dist.ready} ${LABEL_TEXT.ready} / ${dist.work} ${LABEL_TEXT.work} / ${dist.none} ${LABEL_TEXT.none}`);
} else {
  console.log(`${failures} CHECK(S) FAILED`);
  process.exit(1);
}
