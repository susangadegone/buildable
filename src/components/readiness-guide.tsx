export function ReadinessGuide() {
  return <section className="readiness-guide" aria-labelledby="readiness-guide-heading">
    <h2 id="readiness-guide-heading">How the readiness label is decided</h2>
    <dl className="guide-factors">
      <div><dt>Freshness <span>35 points</span></dt><dd>Time since the last update is judged against the dataset's expected update rhythm.</dd></div>
      <div><dt>Access <span>25 points</span></dt><dd>An open API earns full points; dashboards and file attachments earn less.</dd></div>
      <div><dt>Granularity <span>20 points</span></dt><dd>Individual records with geometry score higher than aggregates or tables needing a join.</dd></div>
      <div><dt>Stability <span>20 points</span></dt><dd>Documented catches reduce the score, and replaced datasets receive no stability points.</dd></div>
    </dl>
    <ul className="guide-thresholds"><li>● Ready to build <strong>80–100</strong></li><li>◑ Usable with work <strong>50–79</strong></li><li>○ Not available yet <strong>Under 50</strong></li></ul>
    <p className="guide-hard-gate">A dataset that has stopped updating or been replaced is capped at 45 no matter how clean it looks, because you cannot ship something current on data that stopped.</p>
  </section>;
}