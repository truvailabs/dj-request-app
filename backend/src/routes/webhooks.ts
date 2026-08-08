import { Router } from "express";
import type Stripe from "stripe";
import { env } from "../lib/env.js";
import { getStripe } from "../lib/stripe.js";
import { supabaseAdmin } from "../lib/supabase.js";

export const webhooksRouter = Router();

// Reconciliation safety net: accept/reject already set status synchronously,
// but this catches cases that happen outside that path — a card that fails
// after the client thought it was submitting, or a hold that expires/gets
// captured/canceled directly in the Stripe dashboard.
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

  const statusByEventType: Record<string, "accepted" | "rejected"> = {
    "payment_intent.succeeded": "accepted",
    "payment_intent.payment_failed": "rejected",
    "payment_intent.canceled": "rejected",
  };

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
