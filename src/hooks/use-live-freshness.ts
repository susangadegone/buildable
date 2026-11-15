import { useEffect, useState, useSyncExternalStore } from "react";
import type { Result } from "@/lib/matching";
import { applyLiveFreshness, checkFreshness, cadenceNote, getCheckedMetadata, getServerMetadata, metadataLicenses, subscribeMetadata, type LiveMetadata } from "@/lib/live-freshness";

export function useLiveFreshness(stored: Result) {
  const [checked, setChecked] = useState<{ id: string; metadata: LiveMetadata | null } | null>(null);
  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const metadata = await checkFreshness(stored.dataset.id);
        if (mounted) setChecked({ id: stored.dataset.id, metadata });
      } catch {
        if (mounted) setChecked({ id: stored.dataset.id, metadata: null });
      }
    })();
    return () => { mounted = false; };
  }, [stored.dataset.id]);
  const metadata = checked?.id === stored.dataset.id ? checked.metadata : null;
  return {
    ...applyLiveFreshness(stored, metadata?.date ?? null),
    attribution: metadata?.attribution,
    cadenceNote: cadenceNote(stored.dataset.cadence, metadata?.publishingFrequency),
  };
}

/** Observe already checked results; the footer never starts network requests. */
export function useLiveLicenses(ids: readonly string[]) {
  const metadata = useSyncExternalStore(subscribeMetadata, getCheckedMetadata, getServerMetadata);
  return metadataLicenses(metadata, ids);
}