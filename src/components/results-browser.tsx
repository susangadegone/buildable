import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatasetResult } from "@/components/dataset-result";
import type { QueryAnalysis, Result } from "@/lib/matching";
import type { LabelKey } from "@/lib/types";
import { LABEL_COLOR, LABEL_ICON, LABEL_TEXT, CADENCE_LABEL, GEOMETRY_LABEL, formatRows } from "@/lib/readiness";
import { useLiveFreshness } from "@/hooks/use-live-freshness";
import { FreshnessNote } from "@/components/freshness-note";

export type ResultFilter = "all" | LabelKey;
export type ResultSort = "fit" | "readiness" | "updated";
export const readinessLabels: LabelKey[] = ["ready", "work", "none"];

export function resultCounts(results: Result[]) {
  return { all: results.length, ready: results.filter(r => r.score.label === "ready").length, work: results.filter(r => r.score.label === "work").length, none: results.filter(r => r.score.label === "none").length };
}

export function visibleResults(results: Result[], filter: ResultFilter, sort: ResultSort) {
  const visible = results.filter(r => filter === "all" || r.score.label === filter);
  if (sort === "readiness") visible.sort((a, b) => b.score.total - a.score.total);
  if (sort === "updated") visible.sort((a, b) => a.score.daysSinceUpdate - b.score.daysSinceUpdate);
  return visible;
}

export function ReadinessPill({ label }: { label: LabelKey }) {
  return <span className="readiness-badge" style={{ "--readiness-color": LABEL_COLOR[label] } as CSSProperties}>{LABEL_ICON[label]} {LABEL_TEXT[label]}</span>;
}

function LiveTableRow({ result }: { result: Result }) {
  const live = useLiveFreshness(result);
  const { dataset, score } = live.result;
  return <tr>
    <th scope="row"><a href={dataset.datasf_url} target="_blank" rel="noopener noreferrer">{dataset.name}</a></th>
    <td>{LABEL_ICON[score.label]} {LABEL_TEXT[score.label]}</td><td>{score.total}/100</td>
    <td>{score.daysSinceUpdate === 0 ? "Today" : `${score.daysSinceUpdate}d ago`}<small>{dataset.last_updated}</small><FreshnessNote status={live.status} /></td>
    <td>{CADENCE_LABEL[dataset.cadence]}</td><td>{GEOMETRY_LABEL[dataset.geometry]}</td><td>{formatRows(dataset.rows) ?? "—"}</td>
    <td><a className="dataset-id" href={dataset.datasf_url} target="_blank" rel="noopener noreferrer">{dataset.id}</a></td>
  </tr>;
}

export function ResultsBrowser({ results, analysis, filter, sort, table, onFilter, onSort, onTable }: {
  results: Result[]; analysis: QueryAnalysis; filter: ResultFilter; sort: ResultSort; table: boolean;
  onFilter: (value: ResultFilter) => void; onSort: (value: ResultSort) => void; onTable: (value: boolean) => void;
}) {
  const counts = resultCounts(results);
  const visible = visibleResults(results, filter, sort);
  return <>
    <div className="results-toolbar">
      <p className="results-count" role="status" aria-live="polite">{results.length} datasets fit{filter !== "all" && <span className="results-showing"> · {visible.length} shown</span>}</p>
      <div className="results-filters" role="group" aria-label="Filter by readiness">
        <Button variant="example" size="sm" aria-pressed={filter === "all"} onClick={() => onFilter("all")}>All ({counts.all})</Button>
        {readinessLabels.map(label => <Button key={label} variant="example" size="sm" className="readiness-filter" style={{ "--readiness-color": LABEL_COLOR[label] } as CSSProperties} aria-pressed={filter === label} onClick={() => onFilter(label)}>{LABEL_ICON[label]} {LABEL_TEXT[label]} ({counts[label]})</Button>)}
      </div>
      <div className="results-view-controls">
        <Select value={sort} onValueChange={value => { if (value === "fit" || value === "readiness" || value === "updated") onSort(value); }}>
          <SelectTrigger className="results-sort" aria-label="Sort results"><SelectValue /></SelectTrigger>
          <SelectContent className="results-sort-menu"><SelectItem value="fit">Best fit</SelectItem><SelectItem value="readiness">Readiness</SelectItem><SelectItem value="updated">Most recently updated</SelectItem></SelectContent>
        </Select>
        <label className="table-view-toggle"><Switch checked={table} onCheckedChange={onTable} aria-label="Table view" />Table view</label>
      </div>
    </div>
    {visible.length > 0 && (table ? <div className="results-table-scroll" tabIndex={0} role="region" aria-label="Dataset table"><table className="results-table">
      <caption className="sr-only">Matched datasets with readiness, scores, and metadata</caption>
      <thead><tr>{["Dataset", "Readiness", "Score", "Updated", "Rhythm", "Geometry", "Rows", "ID"].map(title => <th key={title} scope="col">{title}</th>)}</tr></thead>
      <tbody>{visible.map(result => <LiveTableRow key={result.dataset.id} result={result} />)}</tbody>
    </table></div> : visible.map((result, index) => <DatasetResult key={result.dataset.id} result={result} analysis={analysis} rank={index + 1} />))}
    {results.length === 0 && <p className="dataset-empty">No dataset in the catalogue matched that closely. Try naming the subject more plainly - evictions, bike crashes, food trucks, city salaries.</p>}
    {results.length > 0 && visible.length === 0 && <p className="dataset-empty">No matched datasets have this readiness label.</p>}
  </>;
}