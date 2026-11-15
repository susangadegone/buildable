import { useEffect, useState } from "react";
import type { Result } from "@/lib/matching";
import { applyLiveFreshness, checkFreshness } from "@/lib/live-freshness";

export function useLiveFreshness(stored: Result) {
  const [checked, setChecked] = useState<{ id: string; date: string | null } | null>(null);
  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const date = await checkFreshness(stored.dataset.id);
        if (mounted) setChecked({ id: stored.dataset.id, date });
      } catch {
        if (mounted) setChecked({ id: stored.dataset.id, date: null });
      }
    })();
    return () => { mounted = false; };
  }, [stored.dataset.id]);
  return applyLiveFreshness(stored, checked?.id === stored.dataset.id ? checked.date : null);
}