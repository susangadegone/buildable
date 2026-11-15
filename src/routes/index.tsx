import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import catalog from "@/data/catalog.json";
import type { Catalog } from "@/lib/types";
import { search, suggestAdjacent } from "@/lib/search";
import { ResultsBrowser, ReadinessPill, type ResultFilter, type ResultSort } from "@/components/results-browser";
import { ReadinessGuide } from "@/components/readiness-guide";
import { useLiveLicenses } from "@/hooks/use-live-freshness";

const description = "Describe what you're building for San Francisco. See which city datasets fit, and whether they're ready for real users today.";
const examples = [
  "A map showing renters which blocks have the most eviction notices filed",
  "An app that tells a food truck owner where they are allowed to park",
  "A dashboard tracking whether 311 street cleaning requests get resolved faster in some neighborhoods",
  "A tool that warns cyclists about the most dangerous intersections on their commute",
  "Help people find the nearest public restroom and drinking fountain",
  "Predict which buildings are most at risk in an earthquake",
] as const;

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Buildable — San Francisco datasets" },
    { name: "description", content: description },
    { property: "og:title", content: "Buildable — San Francisco datasets" },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: BuildableScreen,
});

export function BuildableScreen() {
  const [sentence, setSentence] = useState("");
  const [searchResult, setSearchResult] = useState<ReturnType<typeof search> | null>(null);
  const [suggestions, setSuggestions] = useState<ReturnType<typeof suggestAdjacent>>([]);
  const [filter, setFilter] = useState<ResultFilter>("all");
  const [sort, setSort] = useState<ResultSort>("fit");
  const [table, setTable] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const input = useRef<HTMLTextAreaElement>(null);
  const licenses = useLiveLicenses(searchResult?.results.map(result => result.dataset.id) ?? []);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  return (
    <main className="buildable-screen" data-theme={theme}>
      <div className="buildable-content">
        <div className="buildable-title-row"><h1 className="buildable-heading">Buildable</h1><Button variant="example" size="icon" className="theme-toggle" aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun /> : <Moon />}</Button></div>
        <p className="buildable-intro">{description}</p>
        <form className="buildable-form" onSubmit={(event) => {
          event.preventDefault();
          const next = search(catalog as Catalog, sentence);
          setSearchResult(next);
          setSuggestions(suggestAdjacent(catalog as Catalog, sentence, next.results));
          setFilter("all");
          setSort("fit");
        }}>
          <textarea
            ref={input}
            className="buildable-input"
            aria-label="Describe what you're building for San Francisco"
            value={sentence}
            onChange={(event) => setSentence(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <div className="buildable-submit-row">
            <Button type="submit" variant="buildable" className="buildable-submit">Find datasets</Button>
          </div>
          <div className="buildable-examples">
            {examples.map((example) => (
              <Button key={example} type="button" variant="example" className="buildable-example" onClick={() => {
                setSentence(example);
                input.current?.focus();
              }}>{example}</Button>
            ))}
          </div>
        </form>
        <section className="buildable-results" aria-label="Dataset results" aria-live="polite">
          {searchResult && <ResultsBrowser results={searchResult.results} analysis={searchResult.analysis} filter={filter} sort={sort} table={table} onFilter={setFilter} onSort={setSort} onTable={setTable} />}
        </section>
        {suggestions.length > 0 && <section className="adjacent-section" aria-labelledby="adjacent-heading"><h2 id="adjacent-heading">Also worth a look</h2><div className="adjacent-list">{suggestions.map(({ dataset, reason, score }) => <article className="adjacent-item" key={dataset.id}><div className="adjacent-title"><a href={dataset.datasf_url} target="_blank" rel="noopener noreferrer">{dataset.name}</a><ReadinessPill label={score.label} /></div><p>{reason}</p></article>)}</div></section>}
        <ReadinessGuide />
        <footer className="buildable-footer">Dataset names, IDs, portal categories, last-updated timestamps and row counts were read directly from DataSF's Socrata API on 2026-11-14 and are reproduced here unchanged - every ID links back to the live dataset so you can check any of them. Update rhythm, geometry, shape and the documented catches are our assessment, drawn from each dataset's own portal description. The readiness score is this app's opinion, not the city's. Catalogue covers {catalog.datasets.length} datasets chosen to span the themes SF civic projects actually reach for. DataSF publishes well over a thousand, so a dataset's absence here means we have not curated it, not that it does not exist.{licenses.length > 0 && <div className="publisher-licenses">{licenses.map(license => <p key={license}>Publisher license: {license}</p>)}</div>}</footer>
      </div>
    </main>
  );
}
