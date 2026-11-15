import type { CSSProperties } from "react";
import { Copy, ExternalLink, Terminal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { explainMatch, type QueryAnalysis, type Result } from "@/lib/matching";
import { LABEL_TEXT, LABEL_ICON, LABEL_COLOR, CADENCE_LABEL, GEOMETRY_LABEL, GRAIN_LABEL, formatRows } from "@/lib/readiness";
import { useLiveFreshness } from "@/hooks/use-live-freshness";
import { FreshnessNote } from "@/components/freshness-note";

const factors = [
  { key: "freshness", label: "Freshness", maximum: 35 },
  { key: "access", label: "Access", maximum: 25 },
  { key: "granularity", label: "Granularity", maximum: 20 },
  { key: "stability", label: "Stability", maximum: 20 },
] as const;

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`, { duration: 2200 });
  } catch {
    toast.error("Could not copy to clipboard. Please try again.", { duration: 3000 });
  }
}

export function DatasetResult({ result, analysis, rank }: { result: Result; analysis: QueryAnalysis; rank: number }) {
  const live = useLiveFreshness(result);
  const { dataset, match, score } = live.result;
  const rows = formatRows(dataset.rows);
  const badgeStyle = { "--readiness-color": LABEL_COLOR[score.label] } as CSSProperties;

  return (
    <article className="dataset-result" aria-label={dataset.name}>
      <header className="dataset-header">
        <div className="dataset-heading">
          <span className="dataset-rank">{String(rank).padStart(2, "0")}</span>
          <h2>{dataset.name}</h2>
        </div>
        <span className="readiness-badge" style={badgeStyle}>{LABEL_ICON[score.label]} {LABEL_TEXT[score.label]}</span>
      </header>
      <p className="dataset-meta">{[live.attribution ?? dataset.publisher, dataset.category].filter(Boolean).join(" · ")} · <a className="dataset-id" href={dataset.datasf_url} target="_blank" rel="noopener noreferrer">{dataset.id}</a></p>
      <p className="dataset-explanation" dangerouslySetInnerHTML={{ __html: explainMatch(dataset, match, analysis, score) }} />
      <div className="dataset-row-strip"><span className="metric-key">What one row is</span><p>{dataset.one_row_is}</p></div>
      <dl className="dataset-metrics">
        <div><dt className="metric-key">Last updated</dt><dd>{score.daysSinceUpdate === 0 ? "Today" : `${score.daysSinceUpdate}d ago`} <small>{dataset.last_updated}</small> <FreshnessNote status={live.status} /></dd></div>
        <div><dt className="metric-key">Update rhythm</dt><dd>{CADENCE_LABEL[dataset.cadence]}</dd></div>
        <div><dt className="metric-key">Geometry</dt><dd>{GEOMETRY_LABEL[dataset.geometry]}</dd></div>
        <div><dt className="metric-key">Shape</dt><dd>{GRAIN_LABEL[dataset.grain]}</dd></div>
        {rows !== null && <div><dt className="metric-key">Rows</dt><dd>{rows}</dd></div>}
      </dl>
      {dataset.caveats.length > 0 && <ul className="dataset-caveats">{dataset.caveats.map((caveat, index) => <li key={index}><span className="caveat-marker" aria-hidden="true">!</span><span>{caveat}</span></li>)}</ul>}
      <details className="dataset-breakdown">
        <summary>Readiness score: {score.total}/100 - see the breakdown</summary>
        <div className="score-factors">{factors.map(({ key, label, maximum }) => <div className="score-factor" key={key}><span>{label}</span><progress value={score[key]} max={maximum} title={score.why[key]} aria-label={label} /><span className="score-figure">{score[key]}/{maximum}</span>{key === "freshness" && live.cadenceNote && <small className="publisher-cadence-note">{live.cadenceNote}</small>}</div>)}</div>
        {score.hardGateApplied && <p className="hard-gate">Hard gate applied. This dataset scored higher on the four factors, but it has stopped updating or been replaced, so it is capped at 45.</p>}
      </details>
      <div className="dataset-actions">
        <Button asChild variant="example" size="sm"><a href={dataset.datasf_url} target="_blank" rel="noopener noreferrer"><ExternalLink />Open on DataSF</a></Button>
        <Button variant="example" size="sm" onClick={() => void copyText(dataset.api_endpoint, "API endpoint")}><Copy />Copy API endpoint</Button>
        <Button variant="example" size="sm" onClick={() => void copyText(`curl "${dataset.api_endpoint}?$limit=100"`, "curl command")}><Terminal />Copy curl</Button>
      </div>
    </article>
  );
}