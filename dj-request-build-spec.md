# DJ Song Request Platform — MVP Build Spec

**Scope:** One event, one hardcoded DJ account. Live song requests with paid tiers, charged only when the DJ plays the song. This spec is the source of truth for the Level 2 build.

---

## 1. Architecture

```
┌─────────────────────┐         ┌──────────────────────┐
│  React + TS (Vercel) │        │   Node + TS (Railway) │
│  • Attendee page     │        │   • Create PaymentIntents (manual capture)
│  • DJ dashboard      │        │   • Stripe webhooks
│                      │        │   • Capture / cancel on accept / reject
└──────────┬───────────┘        └───────────┬──────────┘
           │                                │
   reads + realtime                   writes + Stripe
           │                                │
           ▼                                ▼
        ┌──────────────────────────────────────┐
        │        Supabase (Postgres + Realtime)  │
        └──────────────────────────────────────┘
                          │
                    Stripe Connect
```

**Division of labor**
- **Frontend → Supabase directly** for all reads and live updates (Supabase Realtime over websockets). No websocket code on the Node server.
- **Frontend → Node backend** only for actions that touch money: creating a request (auth hold), and DJ accept/reject (capture/cancel).
- **Node backend** does exactly three things: create PaymentIntents, handle Stripe webhooks, capture/cancel intents. Nothing else.

**Vendors:** Vercel (frontend) · Railway (Node API) · Supabase (DB + realtime) · Stripe (Connect + payments).

---

## 2. Data Model (Supabase / Postgres)

Three tables. Account data is folded into `events` for now (single DJ). Do **not** persist any iTunes catalog data — only custom setlist songs live in `songs`.

### `events`
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| name | text | e.g. "Warehouse Party — Aug 2026" |
| dj_stripe_account_id | text | Stripe Connect connected account id |
| vip_code | text | e.g. "VIP2026"; matched server-side |
| itunes_search_enabled | boolean | toggle: iTunes search on/off for attendees |
| public_queue_mode | text | `full` \| `top3` \| `hidden` — default `top3` |
| platform_fee_bps | int | platform cut in basis points (e.g. 1000 = 10%) |
| status | text | `active` \| `ended` |
| created_at | timestamptz | default now() |

### `songs` (custom setlist only — never iTunes data)
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| event_id | uuid fk → events | |
| title | text | |
| artist | text | |
| bpm | int null | optional |
| created_at | timestamptz | |

### `requests` (one row per individual request)
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| event_id | uuid fk → events | |
| song_id | uuid fk → songs, null | set when from custom setlist |
| title | text | denormalized; required (covers iTunes-sourced picks) |
| artist | text | denormalized |
| bpm | int null | |
| tier | text | `free` \| `boost` \| `front` |
| amount | int | in cents (0 for free) |
| is_vip | boolean | true when valid vip_code was used |
| requester_name | text | |
| status | text | `pending` \| `accepted` \| `rejected` \| `expired` |
| stripe_payment_intent_id | text null | null for free requests |
| created_at | timestamptz | |

**Stacking:** modeled as one row per request. Grouping by song (title/artist) happens at **read time** in queries and UI. The stacked dollar total the DJ sees is `SUM(amount)` over the group; accepting a song captures every pending PaymentIntent in that group.

**Row-Level Security:** enable RLS. Public (anon) read policy exposes only what `public_queue_mode` allows (see §5). Writes go through the Node backend using the service role key, never from the client.

---

## 3. Payment Flow (Stripe Connect, charge-on-play)

**Wallet-first checkout.** Use Stripe's Express Checkout Element / Payment Request API so Apple Pay + Google Pay appear as the primary buttons. No card form unless a wallet is unavailable. This is both the simplest UX and the fastest path to pay.

**Manual capture (the hold).**
1. Attendee submits a paid request → Node creates a PaymentIntent with `capture_method: 'manual'`, `application_fee_amount` = platform cut, `transfer_data.destination` = `dj_stripe_account_id`. This authorizes (holds) the card without charging.
2. DJ taps **PLAY** on a song → Node captures every `pending` PaymentIntent in that song group → status → `accepted`.
3. DJ taps **PASS** → Node cancels those PaymentIntents (releases the hold, no charge) → status → `rejected`.
4. Event ends with a request still pending → intent is never captured → card never charged. (Holds also auto-expire ~7 days; irrelevant for a one-night event.)

**Free requests** skip Stripe entirely — no PaymentIntent, just a row.

**Checkout disclaimers (must render on the checkout sheet, above the pay button):**
- "Your card is only charged if the DJ plays your song."
- "No refunds unless authorized by the DJ."

**Stripe Connect onboarding (setup page).** One button → Stripe **hosted** onboarding → on return, store the connected account id on the event row. Build none of the onboarding UI yourself.

---

## 4. API Surface (Node / Railway)

Minimal. Everything else (reads, live queue) is Supabase-direct from the client.

| method | route | purpose |
|---|---|---|
| POST | `/requests` | Create a request. If paid, create manual-capture PaymentIntent, return client secret for wallet confirm. Validates vip_code, sets is_vip. |
| POST | `/requests/:songGroup/accept` | Capture all pending intents in the song group; mark accepted. |
| POST | `/requests/:songGroup/reject` | Cancel all pending intents in the group; mark rejected. |
| POST | `/webhooks/stripe` | Handle `payment_intent.*` events; reconcile status; verify signature. |
| POST | `/connect/onboard` | Start hosted Connect onboarding; return redirect URL. |
| GET | `/connect/return` | Store connected account id on the event. |

Song-group identity = normalized (title, artist). Accept/reject operate on the group, not a single row, because stacking means N intents per song.

---

## 5. Crowd Visibility (public attendee list)

Driven by `events.public_queue_mode`. Toggleable per event; **this event defaults to `top3`.**

- **`top3`** (this event): show the top 3 songs by sort order, **VIP rows excluded**, **dollar amounts shown**. Creates a beatable, aspirational leaderboard that drives paid requests.
- **`full`**: entire public list, VIP excluded, amounts shown.
- **`hidden`**: no public list at all.

**Always, in every mode:** VIP requests are never shown publicly, and the free/VIP comp mechanic is never revealed. The DJ dashboard always shows everything regardless of this setting.

**Sort order (shared by DJ view and public slice):** `is_vip DESC, amount DESC, count DESC`. For the public slice, filter out VIP first, then take top N.

---

## 6. Realtime

- DJ dashboard subscribes to `requests` (filtered to `event_id`) via Supabase Realtime → live inserts/updates with no server code.
- Attendee public list subscribes to the same, but the RLS/read policy returns only the `public_queue_mode`-permitted slice.
- Node backend writes flow through to both automatically via Postgres → Realtime.

---

## 7. DJ Dashboard Features (from validated mockup)

- Live queue, songs grouped/stacked, sorted VIP → amount → count.
- **PLAY / PASS** per song group (capture / cancel).
- **Notification threshold** slider — controls what pings the DJ (e.g. ≥ $5).
- **Queue filters** — All / VIP / Paid / $10+ with live counts (view-layer only).
- Running **payout** total (sum of captured amounts).
- Decided list showing PLAYED / REFUNDED-released.

---

## 8. Explicitly OUT of scope for this MVP

- Multiple events or multiple DJs (single hardcoded account + one event).
- User accounts / auth for attendees (magic-link-free; requests are anonymous with a name).
- Persisting any iTunes catalog data.
- Payout ledger UI (read Stripe dashboard for now).
- Native mobile app (responsive web only).
- Phase 2 AI setlist curation.

---

## 9. Open items to confirm before / during build

- Platform fee percentage (set `platform_fee_bps`).
- Exact paid tier amounts (mockup uses $5 boost / $10 front-of-line).
- iTunes search: client-side fetch to iTunes Search API for identification only; write resolved title/artist into the request row; never cache the catalog.

---

## 10. Suggested build order (for Claude Code)

1. Supabase project + schema + RLS policies; seed one event, hardcoded DJ.
2. Node/Railway skeleton + Stripe Connect hosted onboarding → store account id.
3. `POST /requests` with manual-capture PaymentIntent + wallet checkout on the frontend.
4. DJ dashboard reading Supabase Realtime; PLAY/PASS → capture/cancel.
5. Stripe webhook reconciliation.
6. Public list with `public_queue_mode` slice + disclaimers on checkout.
7. Filters, threshold, payout total.
