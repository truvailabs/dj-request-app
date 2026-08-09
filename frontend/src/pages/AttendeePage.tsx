import { useRef, useState } from "react";
import { useActiveEvent } from "../lib/useActiveEvent";
import { useLiveRequests, ANON_SAFE_REQUEST_COLUMNS } from "../lib/useLiveRequests";
import { useTiers } from "../lib/useTiers";
import { groupRequests, normalize } from "../lib/songGroup";
import { searchITunes, type ITunesResult } from "../lib/itunes";
import { createRequest } from "../lib/api";
import { T } from "../lib/theme";
import PaidCheckout from "../components/PaidCheckout";
import type { TierRow } from "../lib/types";

type Selection = { title: string; artist: string; bpm: number | null; songId: string | null };

function formatAmount(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}

const FALLBACK_TIER: TierRow = {
  id: "",
  event_id: "",
  name: "Free request",
  amount: 0,
  sort_order: 0,
  created_at: "",
};

export default function AttendeePage() {
  const { event, loading: eventLoading, error: eventError } = useActiveEvent();
  const { requests } = useLiveRequests(event?.id ?? null, ANON_SAFE_REQUEST_COLUMNS);
  const { tiers } = useTiers(event?.id ?? null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ITunesResult[]>([]);
  const [picked, setPicked] = useState<Selection | null>(null);
  const [requesterName, setRequesterName] = useState("");
  const [vipCode, setVipCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pulseKey, setPulseKey] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<{ clientSecret: string; tier: TierRow } | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchSeq = useRef(0);

  async function runSearch(term: string) {
    setQuery(term);
    setPicked(null);
    setSearchError(null);
    const seq = ++searchSeq.current;

    if (!term.trim()) {
      setResults([]);
      return;
    }
    try {
      const found = await searchITunes(term);
      if (seq === searchSeq.current) setResults(found);
    } catch (err) {
      if (seq === searchSeq.current) setSearchError((err as Error).message);
    }
  }

  function finishSuccess(t: TierRow) {
    if (picked) {
      const key = `${normalize(picked.title)}::${normalize(picked.artist)}`;
      setPulseKey(key);
      setTimeout(() => setPulseKey(null), 900);
    }
    setToast(
      t.amount > 0
        ? `${formatAmount(t.amount)} hold placed — charged only if the DJ plays it`
        : "Request sent to the DJ",
    );
    setTimeout(() => setToast(null), 2600);
    setCheckout(null);
    setPicked(null);
    setQuery("");
    setResults([]);
    setVipCode("");
  }

  async function chooseTier(t: TierRow) {
    if (!picked || !requesterName.trim() || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { clientSecret } = await createRequest({
        title: picked.title,
        artist: picked.artist,
        bpm: picked.bpm,
        songId: picked.songId,
        tierId: t.id || undefined,
        requesterName: requesterName.trim(),
        vipCode: vipCode.trim() || undefined,
      });
      if (clientSecret) {
        // Paid tier: the row is created but the hold isn't placed yet —
        // drop into Stripe checkout to actually authorize the card.
        setCheckout({ clientSecret, tier: t });
      } else {
        finishSuccess(t);
      }
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (eventLoading) {
    return (
      <div style={{ minHeight: "100vh", background: T.room, color: T.muted, padding: 20 }}>Loading…</div>
    );
  }
  if (eventError || !event) {
    return (
      <div style={{ minHeight: "100vh", background: T.room, color: T.muted, padding: 20 }}>
        Event not found.
      </div>
    );
  }

  const sorted = event.public_queue_mode === "hidden" ? [] : groupRequests(requests);
  const canSubmit = !!picked && requesterName.trim().length > 0 && !submitting;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.room,
        color: T.ink,
        fontFamily: "'Archivo', 'Helvetica Neue', sans-serif",
      }}
    >
      <div style={{ maxWidth: 420, margin: "0 auto", padding: "20px 16px 80px" }}>
        <header style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, paddingBottom: 6 }}>
              {[
                ["eq1", 0],
                ["eq2", 0.15],
                ["eq3", 0.3],
              ].map(([a, d], i) => (
                <span
                  key={i}
                  className="eqbar"
                  style={{
                    width: 4,
                    borderRadius: 2,
                    background: T.grad,
                    animation: `${a} .9s ease-in-out ${d}s infinite`,
                  }}
                />
              ))}
            </div>
            <h1 style={{ margin: 0, fontWeight: 900, fontSize: 30, lineHeight: 1, letterSpacing: "-.02em" }}>
              {event.name}
            </h1>
          </div>
          <p style={{ margin: "6px 0 0", color: T.muted, fontSize: 14 }}>
            The DJ is taking requests — search below to add yours.
          </p>
        </header>

        <input
          value={query}
          onChange={(e) => runSearch(e.target.value)}
          placeholder="Search a song or artist…"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "14px 16px",
            fontSize: 16,
            borderRadius: 14,
            border: `1px solid ${T.line}`,
            background: T.surface,
            color: T.ink,
          }}
        />

        {results.length > 0 && !picked && (
          <div
            className="rise"
            style={{ marginTop: 10, borderRadius: 14, border: `1px solid ${T.line}`, overflow: "hidden" }}
          >
            {results.map((r, i) => (
              <button
                key={r.trackId}
                onClick={() => setPicked({ title: r.trackName, artist: r.artistName, bpm: null, songId: null })}
                style={{
                  display: "flex",
                  width: "100%",
                  textAlign: "left",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  background: T.surface,
                  border: "none",
                  borderTop: i ? `1px solid ${T.line}` : "none",
                  color: T.ink,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{r.trackName}</div>
                  <div style={{ color: T.muted, fontSize: 13 }}>{r.artistName}</div>
                </div>
                <span style={{ color: T.hot, fontWeight: 700, fontSize: 13 }}>Request →</span>
              </button>
            ))}
          </div>
        )}
        {searchError && (
          <p style={{ color: T.hot, fontSize: 14, marginTop: 12 }}>
            Search failed: {searchError}. Try again, or ask the DJ directly.
          </p>
        )}
        {!searchError && query && results.length === 0 && !picked && (
          <p style={{ color: T.muted, fontSize: 14, marginTop: 12 }}>
            Nothing matched — try another spelling, or ask the DJ directly.
          </p>
        )}

        {picked && (
          <div
            className="rise"
            style={{
              marginTop: 14,
              borderRadius: 16,
              border: `1px solid ${T.line}`,
              background: T.surface,
              padding: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>{picked.title}</div>
                <div style={{ color: T.muted, fontSize: 13 }}>{picked.artist}</div>
              </div>
              <button
                onClick={() => setPicked(null)}
                style={{ background: "none", border: "none", color: T.muted, fontSize: 13 }}
              >
                Cancel
              </button>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <input
                value={requesterName}
                onChange={(e) => setRequesterName(e.target.value)}
                placeholder="Your name"
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "10px 12px",
                  fontSize: 14,
                  borderRadius: 10,
                  border: `1px solid ${T.line}`,
                  background: T.room,
                  color: T.ink,
                }}
              />
              <input
                value={vipCode}
                onChange={(e) => setVipCode(e.target.value)}
                placeholder="VIP code (optional)"
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "10px 12px",
                  fontSize: 14,
                  borderRadius: 10,
                  border: `1px solid ${T.line}`,
                  background: T.room,
                  color: T.ink,
                }}
              />
            </div>

            {!checkout && (
              <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
                {(tiers.length > 0 ? tiers : [FALLBACK_TIER]).map((t) => (
                  <button
                    key={t.id || "fallback"}
                    onClick={() => chooseTier(t)}
                    disabled={!canSubmit}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "13px 14px",
                      borderRadius: 12,
                      textAlign: "left",
                      border: t.amount ? "none" : `1px solid ${T.line}`,
                      background: t.amount ? T.grad : "transparent",
                      color: t.amount ? "#1A0A12" : T.ink,
                      fontWeight: 700,
                      fontSize: 15,
                      opacity: canSubmit ? 1 : 0.5,
                      cursor: canSubmit ? "pointer" : "not-allowed",
                    }}
                  >
                    <span>{t.name}</span>
                    <span style={{ fontWeight: 400, fontSize: 12, opacity: 0.75 }}>
                      {t.amount === 0
                        ? "Free"
                        : !event.payments_enabled
                          ? `${formatAmount(t.amount)} · free tonight`
                          : formatAmount(t.amount)}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {checkout && (
              <PaidCheckout
                clientSecret={checkout.clientSecret}
                amountLabel={formatAmount(checkout.tier.amount)}
                onSuccess={() => finishSuccess(checkout.tier)}
                onCancel={() => setCheckout(null)}
              />
            )}

            {!checkout && !requesterName.trim() && (
              <p style={{ color: T.muted, fontSize: 12, marginTop: 10, marginBottom: 0 }}>
                Enter your name to send this request.
              </p>
            )}
            {submitError && (
              <p style={{ color: T.hot, fontSize: 12, marginTop: 10, marginBottom: 0 }}>{submitError}</p>
            )}
            {!checkout && (
              <p style={{ color: T.muted, fontSize: 12, marginTop: 12, marginBottom: 0 }}>
                Paid requests are only charged if the DJ plays your song. No refunds unless authorized by
                the DJ.
              </p>
            )}
          </div>
        )}

        <section style={{ marginTop: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 99,
                background: T.hot,
                boxShadow: `0 0 0 3px ${T.hot}22`,
              }}
            />
            <h2
              style={{
                margin: 0,
                fontSize: 13,
                letterSpacing: ".14em",
                color: T.muted,
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              What the crowd wants — live
            </h2>
          </div>
          <p style={{ margin: "0 0 10px", color: T.muted, fontSize: 12 }}>
            Top requests right now. Search above to add yours.
          </p>
          {sorted.length === 0 ? (
            <p style={{ color: T.muted, fontSize: 14 }}>No requests yet — yours could open the night.</p>
          ) : (
            <div style={{ borderTop: `1px solid ${T.line}` }}>
              {sorted.map((g, i) => (
                <div
                  key={g.key}
                  className={pulseKey === g.key ? "pump" : ""}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 4px",
                    borderBottom: `1px solid ${T.line}`,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 12,
                      fontWeight: 700,
                      color: g.isVip ? T.warm : T.muted,
                      minWidth: 18,
                      textAlign: "right",
                    }}
                  >
                    {i + 1}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 14,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {g.title}
                      {g.isVip && (
                        <span style={{ color: T.warm, fontSize: 10, fontWeight: 700, marginLeft: 8, letterSpacing: ".08em" }}>
                          VIP
                        </span>
                      )}
                    </div>
                    <div style={{ color: T.muted, fontSize: 12 }}>
                      {g.artist} · {g.count} {g.count === 1 ? "request" : "requests"}
                    </div>
                  </div>
                  {g.totalAmount > 0 && (
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 14, color: T.hot }}>
                      ${(g.totalAmount / 100).toFixed(0)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {toast && (
          <div
            className="rise"
            style={{
              position: "fixed",
              left: "50%",
              bottom: 24,
              transform: "translateX(-50%)",
              background: T.grad,
              color: "#1A0A12",
              fontWeight: 700,
              fontSize: 14,
              padding: "12px 20px",
              borderRadius: 99,
              whiteSpace: "nowrap",
            }}
          >
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
