import { useMemo, useState } from "react";
import { useActiveEvent } from "../lib/useActiveEvent";
import { useLiveRequests } from "../lib/useLiveRequests";
import { useTiers } from "../lib/useTiers";
import { useDjSession } from "../lib/useDjSession";
import { groupRequests, encodeSongGroup } from "../lib/songGroup";
import { decideSongGroup, createTier, updateTier, deleteTier, updateEventSettings } from "../lib/api";
import { supabase } from "../lib/supabase";
import { T } from "../lib/theme";
import type { EventRow, SongGroup, TierRow } from "../lib/types";

type Filter = "all" | "vip" | "paid" | "10plus";

const FILTERS: [Filter, string][] = [
  ["all", "All"],
  ["vip", "VIP"],
  ["paid", "Paid"],
  ["10plus", "$10+"],
];

function TierEditorRow({
  tier,
  djToken,
  busyId,
  setBusyId,
  setError,
}: {
  tier: TierRow;
  djToken: string;
  busyId: string | null;
  setBusyId: (id: string | null) => void;
  setError: (msg: string | null) => void;
}) {
  const [name, setName] = useState(tier.name);
  const [dollars, setDollars] = useState(tier.amount === 0 ? "" : String(tier.amount / 100));
  const busy = busyId === tier.id;
  const dirty = name !== tier.name || dollars !== (tier.amount === 0 ? "" : String(tier.amount / 100));

  async function save() {
    const parsed = Number(dollars);
    const amount = dollars.trim() === "" || !Number.isFinite(parsed) || parsed < 0 ? 0 : Math.round(parsed * 100);
    if (!name.trim()) return;
    setBusyId(tier.id);
    setError(null);
    try {
      await updateTier(tier.id, { name: name.trim(), amount }, djToken);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function remove() {
    setBusyId(tier.id);
    setError(null);
    try {
      await deleteTier(tier.id, djToken);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={busy}
        style={{
          flex: 1,
          padding: "8px 10px",
          borderRadius: 8,
          border: `1px solid ${T.line}`,
          background: T.room,
          color: T.ink,
          fontSize: 13,
          fontFamily: "inherit",
        }}
      />
      <div style={{ position: "relative", width: 90 }}>
        <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: T.muted, fontSize: 13 }}>
          $
        </span>
        <input
          value={dollars}
          onChange={(e) => setDollars(e.target.value)}
          placeholder="0"
          disabled={busy}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "8px 10px 8px 18px",
            borderRadius: 8,
            border: `1px solid ${T.line}`,
            background: T.room,
            color: T.ink,
            fontSize: 13,
            fontFamily: "inherit",
          }}
        />
      </div>
      <button
        onClick={save}
        disabled={busy || !dirty}
        style={{
          padding: "8px 10px",
          borderRadius: 8,
          border: "none",
          background: dirty ? T.grad : T.line,
          color: dirty ? "#1A0A12" : T.muted,
          fontWeight: 700,
          fontSize: 11,
          fontFamily: "inherit",
          opacity: busy ? 0.6 : 1,
        }}
      >
        SAVE
      </button>
      <button
        onClick={remove}
        disabled={busy}
        style={{
          padding: "8px 10px",
          borderRadius: 8,
          border: `1px solid ${T.line}`,
          background: "transparent",
          color: T.muted,
          fontWeight: 700,
          fontSize: 11,
          fontFamily: "inherit",
          opacity: busy ? 0.6 : 1,
        }}
      >
        REMOVE
      </button>
    </div>
  );
}

function PaymentsToggle({ event, djToken }: { event: EventRow; djToken: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const on = event.payments_enabled;

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      await updateEventSettings(!on, djToken);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        padding: "14px",
        borderRadius: 10,
        background: T.surface,
        border: `1px solid ${on ? T.hot : T.line}`,
        marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={toggle}
          disabled={busy}
          style={{
            width: 44,
            height: 24,
            borderRadius: 99,
            border: "none",
            background: on ? T.grad : T.line,
            position: "relative",
            flexShrink: 0,
            opacity: busy ? 0.6 : 1,
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 3,
              left: on ? 23 : 3,
              width: 18,
              height: 18,
              borderRadius: 99,
              background: on ? "#1A0A12" : T.muted,
              transition: "left .15s ease",
            }}
          />
        </button>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: on ? T.ink : T.muted }}>
            PAYMENTS {on ? "ON" : "OFF"}
          </div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
            {on
              ? "Live — paid tiers create real Stripe holds."
              : "Off — every request is free, regardless of tier. Only flip on after your live smoke test passes."}
          </div>
        </div>
      </div>
      {error && <p style={{ color: T.hot, fontSize: 12, marginTop: 10, marginBottom: 0 }}>{error}</p>}
    </div>
  );
}

function TierSettings({ eventId, djToken }: { eventId: string; djToken: string }) {
  const { tiers } = useTiers(eventId);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newDollars, setNewDollars] = useState("");

  async function addTier() {
    if (!newName.trim()) return;
    const parsed = Number(newDollars);
    const amount = newDollars.trim() === "" || !Number.isFinite(parsed) || parsed < 0 ? 0 : Math.round(parsed * 100);
    setBusyId("new");
    setError(null);
    try {
      await createTier(newName.trim(), amount, djToken);
      setNewName("");
      setNewDollars("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div
      style={{
        padding: "14px",
        borderRadius: 10,
        background: T.surface,
        border: `1px solid ${T.line}`,
        marginBottom: 16,
      }}
    >
      <h2 style={{ fontSize: 11, letterSpacing: ".14em", color: T.muted, fontWeight: 700, margin: "0 0 10px" }}>
        REQUEST TIERS
      </h2>
      <div style={{ display: "grid", gap: 8 }}>
        {tiers.map((t) => (
          <TierEditorRow key={t.id} tier={t} djToken={djToken} busyId={busyId} setBusyId={setBusyId} setError={setError} />
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New tier name"
          style={{
            flex: 1,
            padding: "8px 10px",
            borderRadius: 8,
            border: `1px solid ${T.line}`,
            background: T.room,
            color: T.ink,
            fontSize: 13,
            fontFamily: "inherit",
          }}
        />
        <div style={{ position: "relative", width: 90 }}>
          <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: T.muted, fontSize: 13 }}>
            $
          </span>
          <input
            value={newDollars}
            onChange={(e) => setNewDollars(e.target.value)}
            placeholder="0"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "8px 10px 8px 18px",
              borderRadius: 8,
              border: `1px solid ${T.line}`,
              background: T.room,
              color: T.ink,
              fontSize: 13,
              fontFamily: "inherit",
            }}
          />
        </div>
        <button
          onClick={addTier}
          disabled={busyId === "new" || !newName.trim()}
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: "none",
            background: T.grad,
            color: "#1A0A12",
            fontWeight: 700,
            fontSize: 11,
            fontFamily: "inherit",
            opacity: busyId === "new" || !newName.trim() ? 0.6 : 1,
          }}
        >
          ADD TIER
        </button>
      </div>

      {error && <p style={{ color: T.hot, fontSize: 12, marginTop: 10, marginBottom: 0 }}>{error}</p>}
      <p style={{ color: T.muted, fontSize: 11, marginTop: 10, marginBottom: 0 }}>
        $0 tiers are free. Amounts only apply once payments are enabled for tonight.
      </p>
    </div>
  );
}

export default function DjDashboardPage() {
  const { session } = useDjSession();
  const { event } = useActiveEvent();
  const { requests } = useLiveRequests(event?.id ?? null);

  const [filter, setFilter] = useState<Filter>("all");
  const [threshold, setThreshold] = useState(5);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [pulseKey, setPulseKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const pending = requests.filter((r) => r.status === "pending");
  const acceptedRows = requests.filter((r) => r.status === "accepted");
  const rejectedRows = requests.filter((r) => r.status === "rejected");

  const sorted = useMemo(() => groupRequests(pending), [pending]);
  const decidedGroups = useMemo(
    () => groupRequests([...acceptedRows, ...rejectedRows]),
    [acceptedRows, rejectedRows],
  );

  const filterCounts: Record<Filter, number> = {
    all: sorted.length,
    vip: sorted.filter((g) => g.isVip).length,
    paid: sorted.filter((g) => g.totalAmount > 0).length,
    "10plus": sorted.filter((g) => g.totalAmount >= 1000).length,
  };

  const djQueue = sorted.filter((g) => {
    if (filter === "vip") return g.isVip;
    if (filter === "paid") return g.totalAmount > 0;
    if (filter === "10plus") return g.totalAmount >= 1000;
    return true;
  });

  const payout = acceptedRows.reduce((s, r) => s + r.amount, 0) / 100;
  const thresholdCents = threshold * 100;
  const alerts = pending.length
    ? sorted.filter((g) => g.totalAmount >= thresholdCents && threshold > 0).length
    : 0;

  async function decide(group: SongGroup, decision: "accept" | "reject") {
    if (!session) return;
    setBusyKey(group.key);
    setActionError(null);
    try {
      const param = encodeSongGroup(group.title, group.artist);
      await decideSongGroup(param, decision, session.access_token);
      setPulseKey(group.key);
      setTimeout(() => setPulseKey(null), 900);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  if (!event) {
    return (
      <div style={{ minHeight: "100vh", background: T.room, color: T.muted, padding: 20 }}>Loading…</div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.room,
        color: T.ink,
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "20px 16px 60px" }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: ".04em" }}>
              QUEUE // {event.name.toUpperCase()}
            </h1>
            <div style={{ color: T.muted, fontSize: 12, marginTop: 4 }}>
              {pending.length} pending · {acceptedRows.length} accepted · {rejectedRows.length} passed
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 18 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: T.muted, letterSpacing: ".1em" }}>PAYOUT SO FAR</div>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  background: T.grad,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                ${payout.toFixed(0)}
              </div>
            </div>
            <button
              onClick={() => setShowSettings((v) => !v)}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: `1px solid ${showSettings ? T.hot : T.line}`,
                background: showSettings ? `${T.hot}1A` : "transparent",
                color: showSettings ? T.ink : T.muted,
                fontWeight: 700,
                fontSize: 11,
              }}
            >
              SETTINGS
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: `1px solid ${T.line}`,
                background: "transparent",
                color: T.muted,
                fontWeight: 700,
                fontSize: 11,
              }}
            >
              SIGN OUT
            </button>
          </div>
        </header>

        {showSettings && session && (
          <>
            <PaymentsToggle event={event} djToken={session.access_token} />
            <TierSettings eventId={event.id} djToken={session.access_token} />
          </>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 14px",
            borderRadius: 10,
            background: T.surface,
            border: `1px solid ${T.line}`,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 12, color: T.muted }}>Ping me only for requests ≥</span>
          <input
            type="range"
            min={0}
            max={20}
            step={5}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            style={{ accentColor: T.hot }}
          />
          <span style={{ fontSize: 14, fontWeight: 700, color: T.hot, minWidth: 34 }}>
            {threshold === 0 ? "all" : `$${threshold}`}
          </span>
          <span style={{ fontSize: 12, color: T.muted, marginLeft: "auto" }}>
            {alerts} {alerts === 1 ? "alert" : "alerts"} live
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: T.muted, letterSpacing: ".08em", marginRight: 2 }}>SHOW</span>
          {FILTERS.map(([id, label]) => {
            const active = filter === id;
            const n = filterCounts[id];
            const accent = id === "vip" ? T.warm : T.hot;
            return (
              <button
                key={id}
                onClick={() => setFilter(id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: `1px solid ${active ? accent : T.line}`,
                  background: active ? `${accent}1A` : "transparent",
                  color: active ? T.ink : T.muted,
                  fontWeight: 700,
                  fontSize: 12,
                  fontFamily: "inherit",
                }}
              >
                {label}
                <span style={{ fontSize: 10, color: active ? accent : T.muted }}>{n}</span>
              </button>
            );
          })}
        </div>

        {actionError && <p style={{ color: T.hot, fontSize: 13 }}>{actionError}</p>}

        <div style={{ display: "grid", gap: 8 }}>
          {djQueue.length === 0 && (
            <p style={{ color: T.muted, fontSize: 13 }}>
              {sorted.length === 0
                ? "Queue is clear. Requests land here as the crowd scans the QR."
                : `No ${filter === "vip" ? "VIP" : filter === "paid" ? "paid" : filter === "10plus" ? "$10+" : ""} requests right now — switch back to All.`}
            </p>
          )}
          {djQueue.map((g) => {
            const hot = g.totalAmount >= thresholdCents && threshold > 0;
            return (
              <div
                key={g.key}
                className={pulseKey === g.key ? "pump" : ""}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: T.surface,
                  border: `1px solid ${g.isVip ? T.warm : hot ? T.hot : T.line}`,
                }}
              >
                <div style={{ minWidth: 52, textAlign: "right" }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: g.totalAmount ? T.ink : T.muted }}>
                    {g.totalAmount ? `$${(g.totalAmount / 100).toFixed(0)}` : "free"}
                  </div>
                  <div style={{ fontSize: 10, color: T.muted }}>×{g.count}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {g.title}
                    {g.isVip && <span style={{ color: T.warm, marginLeft: 8, fontSize: 11 }}>★ VIP</span>}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: T.muted,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {g.artist}
                    {g.bpm ? ` · ${g.bpm} BPM` : ""} · {g.requests.map((r) => r.requester_name).filter(Boolean).join(", ")}
                  </div>
                </div>
                <button
                  onClick={() => decide(g, "accept")}
                  disabled={busyKey === g.key}
                  style={{
                    padding: "9px 16px",
                    borderRadius: 8,
                    border: "none",
                    background: T.grad,
                    color: "#1A0A12",
                    fontWeight: 700,
                    fontSize: 13,
                    fontFamily: "inherit",
                    opacity: busyKey === g.key ? 0.6 : 1,
                  }}
                >
                  PLAY
                </button>
                <button
                  onClick={() => decide(g, "reject")}
                  disabled={busyKey === g.key}
                  style={{
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: `1px solid ${T.line}`,
                    background: "transparent",
                    color: T.muted,
                    fontWeight: 700,
                    fontSize: 13,
                    fontFamily: "inherit",
                    opacity: busyKey === g.key ? 0.6 : 1,
                  }}
                >
                  PASS
                </button>
              </div>
            );
          })}
        </div>

        {(acceptedRows.length > 0 || rejectedRows.length > 0) && (
          <section style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 11, letterSpacing: ".14em", color: T.muted, fontWeight: 700 }}>DECIDED</h2>
            <div style={{ display: "grid", gap: 6 }}>
              {decidedGroups.map((g) => {
                const status = g.requests[0]?.status;
                const isAccepted = status === "accepted";
                return (
                  <div
                    key={g.key}
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "center",
                      padding: "8px 14px",
                      borderRadius: 8,
                      background: T.room,
                      border: `1px solid ${T.line}`,
                      opacity: 0.8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: isAccepted ? T.warm : T.muted,
                        minWidth: 70,
                      }}
                    >
                      {isAccepted ? "PLAYED" : "REFUNDED"}
                    </span>
                    <span style={{ fontSize: 13, flex: 1 }}>
                      {g.title} — {g.artist}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        color: isAccepted ? T.ink : T.muted,
                        textDecoration: isAccepted ? "none" : "line-through",
                      }}
                    >
                      {g.totalAmount ? `$${(g.totalAmount / 100).toFixed(0)}` : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
            {rejectedRows.some((r) => r.amount > 0) && (
              <p style={{ fontSize: 11, color: T.muted, marginTop: 8 }}>
                Passed requests release the card hold automatically — no charge, no refund to process.
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
