import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import catalog from "@/data/catalog.json";
import type { Catalog } from "@/lib/types";
import { search } from "@/lib/search";
import { DatasetResult } from "@/components/dataset-result";

const description = "Describe what you're building for San Francisco. See which city datasets fit, and whether you can actually ship with them today.";
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
  const input = useRef<HTMLTextAreaElement>(null);

  return (
    <main className="buildable-screen" data-theme="dark">
      <div className="buildable-content">
        <h1 className="buildable-heading">Buildable</h1>
        <p className="buildable-intro">{description}</p>
        <form className="buildable-form" onSubmit={(event) => {
          event.preventDefault();
          setSearchResult(search(catalog as Catalog, sentence));
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
          {searchResult?.results.map((result, index) => <DatasetResult key={result.dataset.id} result={result} analysis={searchResult.analysis} rank={index + 1} />)}
          {searchResult && searchResult.results.length === 0 && <p className="dataset-empty">No dataset in the catalogue matched that closely. Try naming the subject more plainly - evictions, bike crashes, food trucks, city salaries.</p>}
        </section>
      </div>
    </main>
  );
}
