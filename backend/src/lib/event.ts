import { supabaseAdmin } from "./supabase.js";

export type EventRow = {
  id: string;
  name: string;
  vip_code: string;
  itunes_search_enabled: boolean;
  public_queue_mode: string;
  payments_enabled: boolean;
  status: string;
};

let cached: EventRow | null = null;

// Single-event, single-DJ scope for tonight: always resolve the one active event.
export async function getActiveEvent(): Promise<EventRow> {
  if (cached) return cached;
  const { data, error } = await supabaseAdmin
    .from("events")
    .select("id, name, vip_code, itunes_search_enabled, public_queue_mode, payments_enabled, status")
    .eq("status", "active")
    .limit(1)
    .single();
  if (error || !data) throw new Error(`No active event found: ${error?.message ?? "none"}`);
  cached = data;
  return data;
}

export function invalidateEventCache() {
  cached = null;
}
