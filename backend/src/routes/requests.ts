import { Router } from "express";
import { supabaseAdmin } from "../lib/supabase.js";
import { getActiveEvent } from "../lib/event.js";
import { normalize, decodeSongGroup } from "../lib/songGroup.js";
import { requireDj } from "../middleware/requireDj.js";

export const requestsRouter = Router();

const TIER_AMOUNTS: Record<string, number> = {
  free: 0,
  boost: 500,
  front: 2000,
};

requestsRouter.post("/requests", async (req, res) => {
  const { title, artist, bpm, songId, tier, requesterName, vipCode } = req.body ?? {};

  if (typeof title !== "string" || !title.trim() || typeof artist !== "string" || !artist.trim()) {
    res.status(400).json({ error: "title and artist are required" });
    return;
  }
  if (typeof requesterName !== "string" || !requesterName.trim()) {
    res.status(400).json({ error: "requesterName is required" });
    return;
  }

  const event = await getActiveEvent();
  const isVip = typeof vipCode === "string" && vipCode.trim().length > 0 && vipCode.trim() === event.vip_code;

  // Server decides the real tier/amount — never trust the client for money.
  // While payments are off, every request is free regardless of what tier the client selected.
  const requestedTier = typeof tier === "string" && tier in TIER_AMOUNTS ? tier : "free";
  const effectiveTier = event.payments_enabled ? requestedTier : "free";
  const amount = event.payments_enabled ? TIER_AMOUNTS[effectiveTier] : 0;

  if (event.payments_enabled && amount > 0) {
    // Phase 2 will branch here to create a manual-capture PaymentIntent and return a client secret.
    res.status(501).json({ error: "Paid requests are not wired up yet" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("requests")
    .insert({
      event_id: event.id,
      song_id: typeof songId === "string" ? songId : null,
      title: title.trim(),
      artist: artist.trim(),
      bpm: typeof bpm === "number" ? bpm : null,
      tier: effectiveTier,
      amount,
      is_vip: isVip,
      requester_name: requesterName.trim(),
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(201).json({ request: data });
});

async function updateSongGroupStatus(songGroupParam: string, status: "accepted" | "rejected") {
  const event = await getActiveEvent();
  const { title, artist } = decodeSongGroup(songGroupParam);
  const wantTitle = normalize(title);
  const wantArtist = normalize(artist);

  const { data: pending, error: fetchError } = await supabaseAdmin
    .from("requests")
    .select("id, title, artist")
    .eq("event_id", event.id)
    .eq("status", "pending");

  if (fetchError) throw new Error(fetchError.message);

  const ids = (pending ?? [])
    .filter((r) => normalize(r.title) === wantTitle && normalize(r.artist) === wantArtist)
    .map((r) => r.id);

  if (ids.length === 0) return { updated: 0 };

  const { error: updateError } = await supabaseAdmin.from("requests").update({ status }).in("id", ids);
  if (updateError) throw new Error(updateError.message);

  return { updated: ids.length };
}

requestsRouter.post("/requests/:songGroup/accept", requireDj, async (req, res) => {
  try {
    const result = await updateSongGroupStatus(String(req.params.songGroup), "accepted");
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

requestsRouter.post("/requests/:songGroup/reject", requireDj, async (req, res) => {
  try {
    const result = await updateSongGroupStatus(String(req.params.songGroup), "rejected");
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});
