import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import type { RequestRow } from "./types";

// Anon only has a column-level GRANT on a safe subset of `requests`
// columns (no requester_name / stripe_payment_intent_id) — PostgREST's
// `select=*` requires privilege on *every* column, so anon callers must
// pass that subset explicitly or every request 401s with "permission
// denied for table requests". The DJ dashboard (authenticated, full grant)
// can just pass "*".
export const ANON_SAFE_REQUEST_COLUMNS =
  "id, event_id, song_id, title, artist, bpm, tier, amount, is_vip, status, created_at";

// Realtime only tells us *something* changed — re-running the SELECT lets
// RLS re-decide the current visible set (important for the anon top-3 policy,
// where a row can fall out of view because a *different* row changed, not
// because the row itself did).
//
// Realtime + RLS gap: Postgres evaluates the anon SELECT policy against a
// row's *new* state, so when a row transitions from visible to invisible
// (e.g. pending -> accepted, which drops it out of the anon top-3 policy),
// Supabase never delivers that change event to anon subscribers at all —
// there's nothing to tell them to refetch, so a played/passed song can be
// stuck showing on the public list indefinitely. A short poll interval is
// a cheap safety net that self-corrects within a few seconds regardless of
// whether Realtime told us anything.
const POLL_MS = 4000;

export function useLiveRequests(eventId: string | null, columns: string = "*") {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const refetchTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!eventId) return;

    let cancelled = false;

    async function refetch() {
      const { data, error } = await supabase
        .from("requests")
        .select(columns)
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });
      if (!cancelled && !error && data) setRequests(data as RequestRow[]);
      if (!cancelled) setLoading(false);
    }

    refetch();

    const channel = supabase
      .channel(`requests-${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "requests", filter: `event_id=eq.${eventId}` },
        () => {
          if (refetchTimer.current) window.clearTimeout(refetchTimer.current);
          refetchTimer.current = window.setTimeout(refetch, 150);
        },
      )
      .subscribe();

    const pollInterval = window.setInterval(refetch, POLL_MS);

    return () => {
      cancelled = true;
      if (refetchTimer.current) window.clearTimeout(refetchTimer.current);
      window.clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [eventId, columns]);

  return { requests, loading };
}
