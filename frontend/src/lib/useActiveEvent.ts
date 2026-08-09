import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { EventRow } from "./types";

// Same Realtime-gap pattern seen elsewhere tonight: poll as a safety net so
// a DJ flipping payments_enabled mid-event reaches attendee tabs reliably.
const POLL_MS = 8000;

export function useActiveEvent() {
  const [event, setEvent] = useState<EventRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function refetch() {
      const { data, error } = await supabase
        .from("events")
        .select("id, name, itunes_search_enabled, public_queue_mode, payments_enabled, status, created_at")
        .eq("status", "active")
        .limit(1)
        .single();
      if (cancelled) return;
      if (error) setError(error.message);
      else setEvent(data as EventRow);
      setLoading(false);
    }

    refetch();

    const channel = supabase
      .channel("active-event")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, refetch)
      .subscribe();

    const pollInterval = window.setInterval(refetch, POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, []);

  return { event, loading, error };
}
