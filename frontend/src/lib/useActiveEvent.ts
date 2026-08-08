import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { EventRow } from "./types";

export function useActiveEvent() {
  const [event, setEvent] = useState<EventRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("events")
      .select("id, name, itunes_search_enabled, public_queue_mode, payments_enabled, status, created_at")
      .eq("status", "active")
      .limit(1)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setError(error.message);
        else setEvent(data as EventRow);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { event, loading, error };
}
