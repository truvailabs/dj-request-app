import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { TierRow } from "./types";

// Tiers change rarely (a DJ editing settings), so a longer poll interval
// than requests is fine — it's just a safety net for DELETE events, which
// Realtime doesn't reliably deliver even with RLS wide open (`using (true)`).
const POLL_MS = 8000;

export function useTiers(eventId: string | null) {
  const [tiers, setTiers] = useState<TierRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;

    async function refetch() {
      const { data, error } = await supabase
        .from("tiers")
        .select("*")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true });
      if (!cancelled && !error && data) setTiers(data as TierRow[]);
      if (!cancelled) setLoading(false);
    }

    refetch();

    const channel = supabase
      .channel(`tiers-${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tiers", filter: `event_id=eq.${eventId}` },
        refetch,
      )
      .subscribe();

    const pollInterval = window.setInterval(refetch, POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  return { tiers, loading };
}
