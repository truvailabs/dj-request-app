# TONIGHT — Free-Loop-First Validation Build (12-hour cut)

**Goal:** Validate the core loop at a real party tonight — crowd scans QR, requests songs, DJ sees them live and plays/passes. Payments are **additive, behind a kill-switch**, running to **your own Stripe account** (you pay the DJ manually afterward). If live Stripe misbehaves, flip one flag and run free-only.

> Full architecture + schema live in `dj-request-build-spec.md`. This is the ordered tonight checklist only. Connect / platform fee are OUT tonight.

---

## Non-negotiable principles

1. **Free loop must stand alone.** Build and deploy it first, fully working, before touching Stripe. This is your known-good fallback.
2. **Payments sit on top behind `payments_enabled`.** Off = free rows only, Stripe never called. On = manual-capture hold added to the request path. Flipping the flag needs **no code change**.
3. **Own account, no Connect.** Charges land in your own activated Stripe account. Settle with the DJ by hand. No KYC dependency.
4. **Hard go/no-go, set now:** 2 hours before doors, if the live card smoke test (step 8) hasn't passed cleanly, ship free-only and stop touching Stripe.

---

## Deltas from the main spec (tonight only)

- `events` gets `payments_enabled boolean default false`.
- **No** `application_fee_amount`, **no** `transfer_data.destination`, **no** `dj_stripe_account_id` used for routing. PaymentIntents are plain, on your own account.
- Apple Pay is bonus, not required: **Google Pay + card need no domain verification.** If Apple Pay domain verification hasn't cleared by showtime, wallet checkout still works.
- `public_queue_mode` = `top3` (VIP excluded, amounts shown).

---

## Build order (straight into Claude Code)

### Phase 1 — the fallback (do this first, deploy it, confirm it)
1. **Supabase:** schema (`events`, `songs`, `requests`) + RLS. Seed one event (`payments_enabled=false`), hardcoded DJ, a few custom setlist songs. Public read policy returns only the `top3` / no-VIP slice.
2. **Frontend (Vercel), React+TS:** attendee page (search: iTunes toggle + custom setlist; request tiers *shown but free-only while flag off*; VIP code field) and DJ dashboard (live queue grouped/stacked, PLAY/PASS, filters, threshold, payout total).
3. **Realtime:** DJ dashboard + public list subscribe to Supabase Realtime directly. No websocket code on Node.
4. **Node (Railway):** thin `POST /requests` that writes a free row (no Stripe yet). Accept/reject update status.
5. **DEPLOY NOW, on real URLs.** Wire Supabase + Vercel + Railway env vars and CORS against deployed URLs, not localhost. Confirm the full free loop works end-to-end from your phone. **← This is the event-ready fallback. If you stop here, tonight still works.**

### Phase 2 — payments, additive (only after Phase 1 is green)
6. Add `payments_enabled` flag (off). Confirm nothing changed.
7. **Test mode:** branch `POST /requests` — if paid & flag on, create PaymentIntent `capture_method: manual` on your own account, return client secret. Wallet checkout (Express Checkout Element → Apple/Google Pay + card). Accept → capture group; reject → cancel group. Webhook route with **raw body** signature verification (use Stripe CLI `stripe listen` locally for the signing secret). Prove hold→capture with test cards.
8. **Live smoke test (the real gate):** switch to live keys, flip `payments_enabled` on, run **one real $5 card through yourself** end to end — see the hold, tap PLAY, confirm the capture in the Stripe dashboard, then refund yourself. If clean → payments go live tonight. If not → flag off, free event.

### Checkout must-haves (Phase 2)
- Apple Pay + Google Pay as primary buttons (Express Checkout Element).
- Two disclaimers above the pay button:
  - "Your card is only charged if the DJ plays your song."
  - "No refunds unless authorized by the DJ."

---

## Known time-eaters — hit these right the first time

- **Webhook raw body:** the signature check needs the *raw* request body on the webhook route specifically; default JSON body-parsing breaks it. Set this up correctly from the start.
- **First-time deploy wiring:** env vars + CORS across three services can eat an hour. That's why Phase 1 deploys before Stripe exists — get the plumbing working while stakes are low.
- **Apple Pay domain verification:** start it the moment you have the Vercel domain; treat as bonus, never a blocker (Google Pay + card cover you).

---

## Go / No-Go (decide the clock now)

- **Cutoff: 2 hours before doors.**
- Live smoke test (step 8) passed cleanly → payments ON tonight.
- Anything unresolved → `payments_enabled=false`, run the validated free loop. No live debugging at the venue.
