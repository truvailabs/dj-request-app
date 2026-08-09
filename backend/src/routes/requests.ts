import { Router } from "express";
import { supabaseAdmin } from "../lib/supabase.js";
import { getActiveEvent } from "../lib/event.js";
import { normalize, decodeSongGroup } from "../lib/songGroup.js";
import { requireDj } from "../middleware/requireDj.js";
import { getStripe } from "../lib/stripe.js";

export const requestsRouter = Router();

requestsRouter.post("/requests", async (req, res) => {
  const { title, artist, bpm, songId, tierId, requesterName, vipCode } = req.body ?? {};

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
  // While payments are off, every request is free regardless of what tier
  // (or tier price) the DJ has configured.
  let tierName = "Free";
  let tierRowId: string | null = null;
  let amount = 0;

  if (event.payments_enabled && typeof tierId === "string") {
    const { data: tierRow, error: tierError } = await supabaseAdmin
      .from("tiers")
      .select("id, name, amount")
      .eq("id", tierId)
      .eq("event_id", event.id)
      .maybeSingle();
    if (tierError) {
      res.status(500).json({ error: tierError.message });
      return;
    }
    if (tierRow) {
      tierName = tierRow.name;
      tierRowId = tierRow.id;
      amount = tierRow.amount;
    }
  }

  let stripePaymentIntentId: string | null = null;
  let clientSecret: string | null = null;

  if (event.payments_enabled && amount > 0) {
    // Manual capture: this only authorizes (holds) the card. Nothing is
    // charged until the DJ plays the song and Node explicitly captures it.
    const paymentIntent = await getStripe().paymentIntents.create({
      amount,
      currency: "usd",
      capture_method: "manual",
      // allow_redirects: "never" restricts this to card + wallets (Apple/Google
      // Pay) — no Klarna/Cash App/Amazon Pay/Link, which are redirect-based
      // and require a return_url the confirm flow doesn't provide.
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      metadata: {
        event_id: event.id,
        tier: tierName,
        title: title.trim(),
        artist: artist.trim(),
      },
    });
    stripePaymentIntentId = paymentIntent.id;
    clientSecret = paymentIntent.client_secret;
  }

  const { data, error } = await supabaseAdmin
    .from("requests")
    .insert({
      event_id: event.id,
      song_id: typeof songId === "string" ? songId : null,
      title: title.trim(),
      artist: artist.trim(),
      bpm: typeof bpm === "number" ? bpm : null,
      tier: tierName,
      tier_id: tierRowId,
      amount,
      is_vip: isVip,
      requester_name: requesterName.trim(),
      status: "pending",
      stripe_payment_intent_id: stripePaymentIntentId,
    })
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(201).json({ request: data, clientSecret });
});

type PendingRow = { id: string; title: string; artist: string; stripe_payment_intent_id: string | null };

async function findPendingGroup(songGroupParam: string): Promise<PendingRow[]> {
  const event = await getActiveEvent();
  const { title, artist } = decodeSongGroup(songGroupParam);
  const wantTitle = normalize(title);
  const wantArtist = normalize(artist);

  const { data: pending, error } = await supabaseAdmin
    .from("requests")
    .select("id, title, artist, stripe_payment_intent_id")
    .eq("event_id", event.id)
    .eq("status", "pending");
  if (error) throw new Error(error.message);

  return (pending ?? []).filter(
    (r) => normalize(r.title) === wantTitle && normalize(r.artist) === wantArtist,
  );
}

requestsRouter.post("/requests/:songGroup/accept", requireDj, async (req, res) => {
  try {
    const matches = await findPendingGroup(String(req.params.songGroup));
    if (matches.length === 0) {
      res.json({ updated: 0 });
      return;
    }

    const acceptedIds: string[] = [];
    const failedIds: string[] = [];

    for (const r of matches) {
      if (r.stripe_payment_intent_id) {
        try {
          await getStripe().paymentIntents.capture(r.stripe_payment_intent_id);
          acceptedIds.push(r.id);
        } catch {
          // Hold was never successfully authorized (e.g. card failed
          // client-side) — don't let the DJ "play" money that isn't real.
          failedIds.push(r.id);
        }
      } else {
        acceptedIds.push(r.id);
      }
    }

    if (acceptedIds.length) {
      const { error } = await supabaseAdmin.from("requests").update({ status: "accepted" }).in("id", acceptedIds);
      if (error) throw new Error(error.message);
    }
    if (failedIds.length) {
      const { error } = await supabaseAdmin.from("requests").update({ status: "rejected" }).in("id", failedIds);
      if (error) throw new Error(error.message);
    }

    res.json({ updated: acceptedIds.length, failed: failedIds.length });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

requestsRouter.post("/requests/:songGroup/reject", requireDj, async (req, res) => {
  try {
    const matches = await findPendingGroup(String(req.params.songGroup));
    if (matches.length === 0) {
      res.json({ updated: 0 });
      return;
    }

    for (const r of matches) {
      if (r.stripe_payment_intent_id) {
        try {
          await getStripe().paymentIntents.cancel(r.stripe_payment_intent_id);
        } catch {
          // Already canceled/captured/failed — DB status below is what the
          // DJ dashboard actually reads, so this is safe to ignore.
        }
      }
    }

    const ids = matches.map((r) => r.id);
    const { error } = await supabaseAdmin.from("requests").update({ status: "rejected" }).in("id", ids);
    if (error) throw new Error(error.message);

    res.json({ updated: ids.length });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});
