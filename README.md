# Buildable

**Describe what you're building for San Francisco. See which city datasets fit — and whether you can actually ship with them today.**

San Francisco's open data portal publishes well over a thousand datasets. Finding one that sounds right takes an hour of reading descriptions. The expensive failure isn't *failing to find data* — it's finding data that looks perfect and is quietly dead, then discovering it three hours into a build.

Buildable takes one sentence describing a project and returns the datasets that fit, a plain-English explanation of why each matched, and a verdict on whether it can carry a build today.

---

## The problem, concretely

Search DataSF for restaurant inspection data and the top result is **Health Inspection Scores (2016-2019)**. It has 53,973 rows and clean coordinates. It looks ideal.

It has been dead since 2019 — the LIVES publishing standard behind it was retired in 2021. The portal won't tell you that, because its metadata timestamp still moves even though the data doesn't.

Buildable labels it **Not available yet** and says why.

---

## How readiness is scored

Four factors, 100 points. Every dataset scored identically, and the breakdown is visible on every result — so you can disagree with one number rather than the whole thing.

| Factor | Points | What it measures |
| --- | --- | --- |
| **Freshness** | 35 | Days since last update, judged against how often this dataset is *supposed* to update. A quarterly dataset two months old is healthy; a daily one two months old is broken. |
| **Access** | 25 | Can code reach it right now? Open API with no key scores full. Data trapped in a spreadsheet attachment scores 8. |
| **Granularity** | 20 | Row-level with coordinates is the most useful shape. Pre-aggregated totals and join-dependent child tables score lower. |
| **Stability** | 20 | Documented traps: schema changes mid-history, anonymised locations, partial coverage. Each catch costs points. |

### The labels

| Label | Score | Means |
| --- | --- | --- |
| 🟢 **Ready to build** | 80–100 | Live, reachable, granular enough. Write code against it today. |
| 🟡 **Usable with work** | 50–79 | Real and reachable, but budget time: geocoding, a join, pagination, or a caveat to design around. |
| 🔴 **Not available yet** | 0–49 | Frozen, archived, superseded, or published in a form you can't query. |

### The hard gate

**A dataset that has stopped updating, or that a newer dataset replaced, is capped at 45 points regardless of everything else.**

This single rule does most of the work. Without it, the dead restaurant inspections dataset scores 53 and lands in *Usable with work* — wrong in the most damaging way possible, because it would send someone off to build on data that ends in 2019.

---

## Where the data comes from

The catalogue covers **74 datasets**, chosen to span the themes SF civic projects actually reach for. The split between fact and judgement is deliberate and visible in the app's footer:

| Field | Source |
| --- | --- |
| Dataset ID, name, portal category | Read from DataSF's Socrata API, 2026-11-14 |
| Last-updated timestamp | Read from DataSF's Socrata API, 2026-11-14 |
| Row count | Read from DataSF's Socrata API, 2026-11-14 |
| Update rhythm, geometry, grain, access route | This project's assessment |
| Documented caveats | Drawn from each dataset's own portal description |
| Readiness score and label | This project's rubric |

Every dataset ID links back to the live dataset on DataSF, so any figure can be checked.

Current distribution: **51 Ready to build · 17 Usable with work · 6 Not available yet.** That skew is honest — DataSF is a well-maintained portal. The value isn't that most things are broken; it's that you can't tell which ones are without checking each by hand.

---

## How matching works

Deterministic, no LLM, no API key. This is a deliberate choice:

- It **cannot hallucinate** a dataset or a column that doesn't exist.
- It **cannot rate-limit** or fail mid-demo.
- Explanations are **assembled from facts that actually matched**, so they're always literally true.

The pipeline:

1. **Stemming.** The query is expanded with simple inflections of every token, run twice — `buildings` only reaches `building` on the first pass and needs a second to reach `build`.
2. **Whole-word matching.** Terms are anchored to word boundaries with an optional trailing `s`/`es`. Plain substring matching produces confident nonsense: `earthquake` contains `art`, `fountain` contains `ai`.
3. **Scoring.** Weighted across subject tags, capability tags, raw token overlap, domain match, and an intent bonus.
4. **Intent detection.** Map / trend / live / join / predict. A dataset is rewarded for serving the intent (map intent + has geometry) and penalised for not (map intent + no coordinates).
5. **Explanation assembly.** Three parts — what connected, what it means for this build, and the verdict with its actual reason.

Semantic matching is the obvious next version — as a layer **on top of** this, not a replacement for it.

---

## Known limitations

Stated up front rather than discovered later:

- **74 of a thousand-plus datasets.** A dataset's absence means it wasn't curated, not that it doesn't exist. The rubric is the contribution and it generalises; the catalogue demonstrates it.
- **Update cadence is inferred, not published.** The city doesn't expose it as a machine-readable field — itself part of the problem. It's the softest input in the rubric, and only matters relative to itself.
- **Keyword matching misses paraphrase.** *"Where do people get pushed out of their homes"* won't find eviction data.
- **The scores are opinions with visible arithmetic.** The inputs underneath aren't: dates and row counts come from the API, caveats come from the city's own descriptions.

---

## Running it

```
npm install
npm run dev
```

No API key, no environment variables, no backend. The catalogue ships as a static constant.

---

## Roadmap

1. **Widen the catalogue** by walking the Socrata discovery API and auto-scoring everything, with hand review only for caveats. The rubric already runs on machine-readable fields.
2. **Add a semantic layer** over keyword matching, keeping the deterministic path as fallback.
3. **Watch for decay.** Re-run the freshness check on a schedule and alert when a dataset crosses from *Ready to build* into *Usable with work* — turning a one-off lookup into something worth returning to.

---

## Credits

Dataset metadata © City and County of San Francisco, via [DataSF](https://data.sf.gov). Readiness scoring, matching logic and curation are this project's own.
