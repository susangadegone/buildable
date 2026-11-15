// Buildable — shared types.
// Field names match sf-dataset-catalog.json exactly. Do not rename them.

export type Cadence   = "daily" | "weekly" | "monthly" | "quarterly" | "annual" | "static" | "frozen";
export type Geometry  = "point" | "line" | "polygon" | "none";
export type Grain     = "row" | "join" | "agg" | "ref";
export type Access    = "api" | "dashboard" | "attachment";
export type LabelKey  = "ready" | "work" | "none";

export interface StoredReadiness {
  score: number;
  label: string;
  key: LabelKey;
  freshness: number;
  access: number;
  granularity: number;
  stability: number;
  hard_gate_applied: boolean;
}

export interface Dataset {
  id: string;
  name: string;
  category: string;
  publisher: string | null;
  last_updated: string;        // YYYY-MM-DD
  rows: number | null;
  cadence: Cadence;
  geometry: Geometry;
  grain: Grain;
  access: Access;
  superseded: boolean;
  one_row_is: string;
  caveats: string[];
  tags: string[];
  domains: string[];
  readiness: StoredReadiness;  // precomputed; used ONLY as a test oracle
  datasf_url: string;
  api_endpoint: string;
}

export interface Catalog {
  catalog_version: string;
  snapshot_date: string;       // YYYY-MM-DD — the ONLY "today" the app may use
  source: string;
  verified_fields: string[];
  assessed_fields: string[];
  rubric: unknown;
  dataset_count: number;
  datasets: Dataset[];
}

export interface Score {
  freshness: number;
  access: number;
  granularity: number;
  stability: number;
  total: number;
  label: LabelKey;
  hardGateApplied: boolean;
  daysSinceUpdate: number;
  why: { freshness: string; access: string; granularity: string; stability: string };
}
