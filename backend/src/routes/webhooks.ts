import { Router } from "express";
import type Stripe from "stripe";
import { env } from "../lib/env.js";
import { getStripe } from "../lib/stripe.js";
import { supabaseAdmin } from "../lib/supabase.js";

export const webhooksRouter = Router();

// amount_capturable_updated is the source of truth for "the hold actually
// succeeded" on a manual-capture PaymentIntent — this is where the request
// row gets created (see requests.ts for why it isn't created eagerly at
// POST /requests time: a cancelled/abandoned checkout would otherwise leave
// a phantom pending request the DJ and public leaderboard could see but
// that was never actually paid for).
async function createRequestFromPaymentIntent(pi: Stripe.PaymentIntent) {
  const { data: existing } = await supabaseAdmin
    .from("requests")
    .select("id")
    .eq("stripe_payment_intent_id", pi.id)
    .maybeSingle();
  if (existing) return; // already created (Stripe can redeliver webhook events)

  const md = pi.metadata;
  const { error } = await supabaseAdmin.from("requests").insert({
    event_id: md.event_id,
    song_id: md.song_id || null,
    title: md.title,
    artist: md.artist,
    bpm: md.bpm ? Number(md.bpm) : null,
    tier: md.tier,
    tier_id: md.tier_id || null,
    amount: pi.amount,
    is_vip: md.is_vip === "true",
    requester_name: md.requester_name,
    status: "pending",
    stripe_payment_intent_id: pi.id,
  });
  if (error) {
    console.error(`Failed to create request from PaymentIntent ${pi.id}:`, error.message);
  }
}

// Reconciliation safety net for rows that already exist: accept/reject set
// status synchronously, but this catches cases that happen outside that
// path — a capture/cancel done directly in the Stripe dashboard, etc.
const statusByEventType: Record<string, "accepted" | "rejected"> = {
  "payment_intent.succeeded": "accepted",
  "payment_intent.payment_failed": "rejected",
  "payment_intent.canceled": "rejected",
};

webhooksRouter.post("/webhooks/stripe", async (req, res) => {
  const signature = req.header("stripe-signature");
  if (!signature) {
    res.status(400).json({ error: "Missing stripe-signature header" });
    return;
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, signature, env.stripeWebhookSecret);
  } catch (err) {
    res.status(400).json({ error: `Webhook signature verification failed: ${(err as Error).message}` });
    return;
  }

  if (event.type === "payment_intent.amount_capturable_updated") {
    await createRequestFromPaymentIntent(event.data.object as Stripe.PaymentIntent);
    res.json({ received: true });
    return;
  }

  const nextStatus = statusByEventType[event.type];
  if (nextStatus) {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const { error } = await supabaseAdmin
      .from("requests")
      .update({ status: nextStatus })
      .eq("stripe_payment_intent_id", paymentIntent.id)
      .eq("status", "pending");
    if (error) {
      console.error(`Webhook reconciliation failed for ${paymentIntent.id}:`, error.message);
    }
  }

  res.json({ received: true });
});
