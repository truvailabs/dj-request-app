import Stripe from "stripe";
import { env } from "./env.js";

let client: Stripe | null = null;

// Lazy + optional: a Phase-1-only deploy (payments_enabled always false) never
// needs a Stripe key. Only throw once something actually tries to charge.
export function getStripe(): Stripe {
  if (!env.stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  if (!client) {
    client = new Stripe(env.stripeSecretKey);
  }
  return client;
}
