import { loadStripe } from "@stripe/stripe-js";

const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

// Lazy singleton — only load Stripe.js when a paid tier is actually used.
let promise: ReturnType<typeof loadStripe> | null = null;

export function getStripePromise() {
  if (!key) throw new Error("Missing VITE_STRIPE_PUBLISHABLE_KEY");
  if (!promise) promise = loadStripe(key);
  return promise;
}
