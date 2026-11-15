// Buildable — query analysis, dataset matching, explanation assembly.
// Deterministic by design: no model call, so it cannot invent a dataset or a column.

import type { Dataset, Score } from "./types";
import { CADENCE_ADVERB, capabilities, formatRows } from "./readiness";
import { DOMAIN_LABEL, DOMAIN_WORDS, INTENT_WORDS, META_TAGS, STOP_WORDS } from "./vocab";

export interface QueryAnalysis {
  /** Lowercased, inflection-expanded text. All term matching runs against this. */
  text: string;
  tokens: string[];
  domains: Record<string, string[]>;
  intents: Record<string, string[]>;
}

export interface MatchDetail {
  fit: number;
  subjectTags: string[];
  metaTags: string[];
  tokenHits: number;
  domainHits: string[];
  intentHits: string[];
}

export interface Result { dataset: Dataset; match: MatchDetail; score: Score }

const reCache = new Map<string, RegExp>();

/**
 * Whole-word matcher with an optional plural tail.
 *
 * Plain substring search looks fine and is quietly wrong: "earthquake" contains
 * "art", "fountain" contains "ai", "brain" contains "rai". Those produce
 * confident nonsense that is very hard to spot by eye. The trailing (?:s|es)?
 * lets a multi-word tag like "food truck" still match "food trucks", which token
 * stemming alone cannot reach.
 */
function wordRe(term: string): RegExp {
  let re = reCache.get(term);
  if (!re) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    re = new RegExp(`(^|[^a-z0-9])${escaped}(?:s|es)?([^a-z0-9]|$)`, "i");
    reCache.set(term, re);
  }
  return re;
}

function hits(text: string, terms: string[]): string[] {
  return terms.filter((t) => wordRe(t).test(text));
}

/**
 * Append cheap inflections of every token, in both directions, so the query and
 * the catalogue meet in the middle.
 *
 * Two passes, not one: "buildings" stems only to "building" on the first pass,
 * which still misses the vocabulary entry "build". A single pass silently drops
 * the housing domain for "which buildings are at risk".
 */
export function expandInflections(text: string): string {
  const tokens = text.toLowerCase().replace(/[^a-z0-9\s'-]/g, " ").split(/\s+/).filter(Boolean);
  const extra = new Set<string>();
  const stem = (t: string): void => {
    if (t.length <= 3) return;
    if (t.endsWith("ies")) extra.add(t.slice(0, -3) + "y");
    if (t.endsWith("es"))  extra.add(t.slice(0, -2));
    if (t.endsWith("s"))   extra.add(t.slice(0, -1));
    if (t.endsWith("ing")) extra.add(t.slice(0, -3));
    if (t.endsWith("ed"))  extra.add(t.slice(0, -2));
    extra.add(t + "s");
  };
  tokens.forEach(stem);
  [...extra].forEach(stem);
  return text + " " + [...extra].join(" ");
}

export function analyseQuery(raw: string): QueryAnalysis {
  const cleaned = raw.toLowerCase().replace(/[^a-z0-9\s'-]/g, " ").replace(/\s+/g, " ");
  const text = " " + expandInflections(cleaned) + " ";
  const tokens = cleaned.split(/\s+/).filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  const domains: Record<string, string[]> = {};
  for (const [domain, terms] of Object.entries(DOMAIN_WORDS)) {
    const found = hits(text, terms);
    if (found.length) domains[domain] = found;
  }
  const intents: Record<string, string[]> = {};
  for (const [intent, terms] of Object.entries(INTENT_WORDS)) {
    const found = hits(text, terms);
    if (found.length) intents[intent] = found;
  }
  return { text, tokens, domains, intents };
}

const haystacks = new WeakMap<Dataset, string>();
function haystack(d: Dataset): string {
  let h = haystacks.get(d);
  if (!h) {
    h = expandInflections(
      [d.name, d.category, d.publisher ?? "", d.tags.join(" "), d.one_row_is].join(" ").toLowerCase()
    );
    haystacks.set(d, h);
  }
  return h;
}

export function matchDataset(d: Dataset, a: QueryAnalysis): MatchDetail {
  const subjectTags: string[] = [];
  const metaTags: string[] = [];
  for (const tag of d.tags) {
    if (!wordRe(tag).test(a.text)) continue;
    (META_TAGS.has(tag) ? metaTags : subjectTags).push(tag);
  }

  const hay = haystack(d);
  const seen = new Set<string>();
  let tokenHits = 0;
  for (const t of a.tokens) {
    if (seen.has(t)) continue;
    seen.add(t);
    if (wordRe(t).test(hay)) tokenHits++;
  }

  const domainHits = d.domains.filter((dom) => a.domains[dom]);

  const caps = capabilities(d);
  const intentHits: string[] = [];
  let intentScore = 0;
  if (a.intents.map)  { if (caps.canMap)     { intentScore += 1;   intentHits.push("map"); }  else intentScore -= 0.35; }
  if (a.intents.time) { if (caps.canTrend)   { intentScore += 0.5; intentHits.push("time"); } }
  if (a.intents.live) { if (caps.isLive)     { intentScore += 1;   intentHits.push("live"); } else intentScore -= 0.3; }
  if (a.intents.join) { if (caps.canJoin)    { intentScore += 0.4; intentHits.push("join"); } }
  if (a.intents.ml)   { if (caps.highVolume) { intentScore += 0.8; intentHits.push("ml"); }   else intentScore -= 0.2; }

  const fit =
    2.6 * subjectTags.length +
    0.8 * metaTags.length +
    1.1 * tokenHits +
    3.0 * domainHits.length +
    1.5 * intentScore;

  return { fit, subjectTags, metaTags, tokenHits, domainHits, intentHits };
}

function joinList(items: string[]): string {
  const u = [...new Set(items)];
  if (u.length === 0) return "";
  if (u.length === 1) return u[0];
  if (u.length === 2) return `${u[0]} and ${u[1]}`;
  return `${u.slice(0, -1).join(", ")} and ${u[u.length - 1]}`;
}

/**
 * Assemble the "why it fits" paragraph from facts that actually matched.
 * Every clause is traceable to a matched term or a catalogue field, so the
 * sentence cannot claim something the data does not support.
 * Returns HTML containing only <b> tags.
 */
export function explainMatch(d: Dataset, m: MatchDetail, a: QueryAnalysis, s: Score): string {
  const out: string[] = [];
  const caps = capabilities(d);

  // 1. What connected.
  if (m.subjectTags.length) {
    out.push(`You mentioned <b>${joinList(m.subjectTags.slice(0, 3))}</b>, and that is what this table records.`);
  } else if (m.domainHits.length) {
    out.push(`This is <b>${DOMAIN_LABEL[m.domainHits[0]]}</b> data, the area your sentence is about.`);
  } else {
    out.push("This overlaps your sentence on wording rather than subject &mdash; worth a glance, but check it is really what you meant.");
  }

  // 2. What that means for this build. At most two clauses, or it becomes a run-on.
  const clauses: string[] = [];
  if (m.intentHits.includes("map")) {
    const g = d.geometry === "point" ? "point coordinates mean"
            : d.geometry === "line"  ? "line geometry means"
            : "polygon geometry means";
    clauses.push(`because you want this on a map, the built-in ${g} no geocoding step`);
  } else if (a.intents.map && !caps.canMap) {
    clauses.push("you asked for something map-based, but this table has no coordinates, so you would geocode its address strings first");
  }
  if (m.intentHits.includes("live")) {
    clauses.push("it refreshes daily, about as close to live as the portal gets");
  } else if (a.intents.live && !caps.isLive && d.cadence !== "frozen") {
    clauses.push(`it updates ${CADENCE_ADVERB[d.cadence]}, so it cannot drive anything billed as real-time`);
  }
  if (m.intentHits.includes("time") && d.grain !== "ref") {
    clauses.push("there is enough history behind it to chart a trend");
  }
  if (m.intentHits.includes("ml") && d.rows) {
    clauses.push(`at ${formatRows(d.rows)} rows there is volume enough to model on`);
  }
  if (clauses.length) {
    const two = clauses.slice(0, 2);
    const sentence = two.length === 1 ? two[0] : `${two[0]}, and ${two[1]}`;
    out.push(sentence.replace(/^./, (c) => c.toUpperCase()) + ".");
  }

  // 3. The honest verdict, naming the actual reason.
  if (s.label === "ready") {
    out.push("<b>Nothing stands between you and a working prototype</b> &mdash; it is open, current for its rhythm, and granular enough to query straight away.");
  } else if (s.label === "work") {
    const reasons: string[] = [];
    if (d.grain === "join") reasons.push("it only becomes useful once joined to its parent table");
    if (d.grain === "agg") reasons.push("it arrives pre-aggregated, so individual records are gone");
    if (d.geometry === "none" && d.grain === "row" && a.intents.map) reasons.push("you would geocode it before mapping");
    if (s.freshness < 35 && d.cadence !== "frozen") reasons.push(`it is ${s.why.freshness}`);
    if ((d.rows ?? 0) > 5_000_000) reasons.push("its size forces server-side filtering");
    if (!reasons.length && d.caveats.length) reasons.push("the catches below need designing around");
    out.push(`<b>Usable, but budget time</b> &mdash; ${reasons.length ? joinList(reasons) : "there is friction to absorb"}.`);
  } else {
    const reason = d.superseded ? "another dataset has replaced it"
      : d.cadence === "frozen" ? "it stopped updating, so anything you build on it is frozen in the past"
      : d.access === "attachment" ? "the data is not published in a queryable form"
      : "it is too stale or too coarse to carry a build";
    out.push(`<b>Do not plan a demo on this</b> &mdash; ${reason}.`);
  }
  return out.join(" ");
}

export const FIT_THRESHOLD = 1.2;
export const MAX_RESULTS = 14;
