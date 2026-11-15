import type { FreshnessStatus } from "@/lib/live-freshness";

export function FreshnessNote({ status }: { status: FreshnessStatus }) {
  return <small className="text-muted-foreground">{status === "verified live" ? "✓ verified live" : status}</small>;
}