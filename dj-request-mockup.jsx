import React, { useState, useMemo } from "react";

/* ── Design tokens ──────────────────────────────────────────
   Room:    #120E1C  deep violet-black (club dark, not pure black)
   Surface: #1D1730  raised panel
   Line:    #322A4D  hairline
   Hot:     #FF4D8D  magenta stage light (money / action)
   Warm:    #FFB35C  amber wash (VIP / accents)
   Ink:     #F2EDFF  text
   Muted:   #9188AD  secondary text
   Two registers on purpose: attendee side = party (gradients,
   big type), DJ side = gear (mono data, dense rows).
──────────────────────────────────────────────────────────── */

const T = {
  room: "#120E1C", surface: "#1D1730", line: "#322A4D",
  hot: "#FF4D8D", warm: "#FFB35C", ink: "#F2EDFF", muted: "#9188AD",
  grad: "linear-gradient(100deg,#FF4D8D 0%,#FFB35C 100%)",
};

const CATALOG = [
  { id: 1, title: "Mr. Brightside", artist: "The Killers", bpm: 148 },
  { id: 2, title: "One More Time", artist: "Daft Punk", bpm: 123 },
  { id: 3, title: "Levitating", artist: "Dua Lipa", bpm: 103 },
  { id: 4, title: "September", artist: "Earth, Wind & Fire", bpm: 126 },
  { id: 5, title: "Yeah!", artist: "Usher", bpm: 105 },
  { id: 6, title: "Dancing Queen", artist: "ABBA", bpm: 101 },
  { id: 7, title: "Titanium", artist: "David Guetta ft. Sia", bpm: 126 },
  { id: 8, title: "Crazy in Love", artist: "Beyoncé", bpm: 99 },
  { id: 9, title: "Don't Stop Me Now", artist: "Queen", bpm: 156 },
  { id: 10, title: "Pepas", artist: "Farruko", bpm: 130 },
  { id: 11, title: "Shut Up and Dance", artist: "WALK THE MOON", bpm: 128 },
  { id: 12, title: "gasolina", artist: "Daddy Yankee", bpm: 96 },
];

const TIERS = [
  { id: "free", label: "Free request", amount: 0, note: "Joins the open pool" },
  { id: "boost", label: "Boost — $5", amount: 5, note: "Sorts above free requests" },
  { id: "front", label: "Front of line — $10", amount: 10, note: "Top of the DJ's queue" },
];

let nextId = 100;

const seed = [
  { id: 90, songId: 1, tier: "boost", amount: 10, count: 2, vip: false, status: "pending", names: ["Maya", "Jordan"] },
  { id: 91, songId: 4, tier: "front", amount: 10, count: 1, vip: false, status: "pending", names: ["Sam"] },
  { id: 92, songId: 6, tier: "free", amount: 0, count: 3, vip: false, status: "pending", names: ["Alex", "Priya", "Dev"] },
  { id: 93, songId: 10, tier: "free", amount: 0, count: 1, vip: true, status: "pending", names: ["Bride's table"] },
];

export default function App() {
  const [view, setView] = useState("attendee");
  const [requests, setRequests] = useState(seed);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState(null); // song awaiting tier choice
  const [vipCode, setVipCode] = useState("");
  const [toast, setToast] = useState(null);
  const [pulseId, setPulseId] = useState(null);
  const [threshold, setThreshold] = useState(5);
  const [queueFilter, setQueueFilter] = useState("all"); // all | vip | paid | 10plus
  const [yourName] = useState("You");

  const song = (id) => CATALOG.find((s) => s.id === id);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return CATALOG.filter(
      (s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)
    ).slice(0, 5);
  }, [query]);

  const submit = (tier) => {
    const vip = vipCode.trim().toUpperCase() === "VIP2026";
    setRequests((prev) => {
      const existing = prev.find((r) => r.songId === picked.id && r.status === "pending");
      if (existing) {
        setPulseId(existing.id);
        setTimeout(() => setPulseId(null), 900);
        return prev.map((r) =>
          r.id === existing.id
            ? { ...r, amount: r.amount + tier.amount, count: r.count + 1, vip: r.vip || vip, names: [...r.names, yourName] }
            : r
        );
      }
      return [...prev, { id: nextId++, songId: picked.id, tier: tier.id, amount: tier.amount, count: 1, vip, status: "pending", names: [yourName] }];
    });
    setToast(
      tier.amount > 0
        ? `$${tier.amount} hold placed — charged only if the DJ plays it`
        : vip ? "VIP request sent to the front" : "Request sent to the DJ"
    );
    setTimeout(() => setToast(null), 2600);
    setPicked(null);
    setQuery("");
    setVipCode("");
  };

  const decide = (id, status) => {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  };

  const pending = requests.filter((r) => r.status === "pending");
  const sorted = [...pending].sort((a, b) => (b.vip - a.vip) || (b.amount - a.amount) || (b.count - a.count));
  const djQueue = sorted.filter((r) =>
    queueFilter === "vip" ? r.vip
    : queueFilter === "paid" ? r.amount > 0
    : queueFilter === "10plus" ? r.amount >= 10
    : true
  );
  const filterCounts = {
    all: sorted.length,
    vip: sorted.filter((r) => r.vip).length,
    paid: sorted.filter((r) => r.amount > 0).length,
    "10plus": sorted.filter((r) => r.amount >= 10).length,
  };
  const accepted = requests.filter((r) => r.status === "accepted");
  const rejected = requests.filter((r) => r.status === "rejected");
  const payout = accepted.reduce((s, r) => s + r.amount, 0);
  const alerts = pending.filter((r) => r.amount >= threshold && threshold > 0).length;

  return (
    <div style={{ minHeight: "100vh", background: T.room, color: T.ink, fontFamily: "'Archivo', 'Helvetica Neue', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;900&family=JetBrains+Mono:wght@400;700&display=swap');
        @keyframes pump { 0%{transform:scale(1)} 30%{transform:scale(1.18)} 60%{transform:scale(.96)} 100%{transform:scale(1)} }
        @keyframes eq1 { 0%,100%{height:6px} 50%{height:18px} }
        @keyframes eq2 { 0%,100%{height:14px} 50%{height:5px} }
        @keyframes eq3 { 0%,100%{height:9px} 50%{height:16px} }
        @keyframes rise { from{opacity:0; transform:translateY(8px)} to{opacity:1; transform:translateY(0)} }
        .pump { animation: pump .8s ease; }
        .rise { animation: rise .25s ease; }
        button { cursor: pointer; font-family: inherit; }
        button:focus-visible { outline: 2px solid ${T.warm}; outline-offset: 2px; }
        input:focus-visible { outline: 2px solid ${T.hot}; outline-offset: 1px; }
        @media (prefers-reduced-motion: reduce) { .pump,.rise{animation:none} .eqbar{animation:none !important} }
      `}</style>

      {/* ── View toggle (prototype chrome) ── */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, padding: "14px 16px 0" }}>
        {[["attendee", "Attendee phone"], ["dj", "DJ booth"]].map(([id, label]) => (
          <button key={id} onClick={() => setView(id)}
            style={{
              padding: "8px 18px", borderRadius: 99, border: `1px solid ${view === id ? "transparent" : T.line}`,
              background: view === id ? T.grad : "transparent",
              color: view === id ? "#1A0A12" : T.muted, fontWeight: 700, fontSize: 13, letterSpacing: ".02em",
            }}>
            {label}{id === "dj" && alerts > 0 && view !== "dj" ? ` · ${alerts}` : ""}
          </button>
        ))}
      </div>

      {view === "attendee" ? (
        /* ══════════ ATTENDEE — the party register ══════════ */
        <div style={{ maxWidth: 420, margin: "0 auto", padding: "20px 16px 80px" }}>
          <header style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 3, paddingBottom: 6 }}>
                {[["eq1", 0], ["eq2", .15], ["eq3", .3]].map(([a, d], i) => (
                  <span key={i} className="eqbar" style={{ width: 4, borderRadius: 2, background: T.grad, animation: `${a} .9s ease-in-out ${d}s infinite` }} />
                ))}
              </div>
              <h1 style={{ margin: 0, fontWeight: 900, fontSize: 30, lineHeight: 1, letterSpacing: "-.02em" }}>
                Riley&nbsp;&amp;&nbsp;Sam
              </h1>
            </div>
            <p style={{ margin: "6px 0 0", color: T.muted, fontSize: 14 }}>
              Reception · DJ Marco is taking requests
            </p>
          </header>

          {/* Search */}
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPicked(null); }}
            placeholder="Search a song or artist…"
            style={{
              width: "100%", boxSizing: "border-box", padding: "14px 16px", fontSize: 16,
              borderRadius: 14, border: `1px solid ${T.line}`, background: T.surface, color: T.ink,
            }}
          />

          {/* Results */}
          {results.length > 0 && !picked && (
            <div className="rise" style={{ marginTop: 10, borderRadius: 14, border: `1px solid ${T.line}`, overflow: "hidden" }}>
              {results.map((s, i) => (
                <button key={s.id} onClick={() => setPicked(s)}
                  style={{
                    display: "flex", width: "100%", textAlign: "left", alignItems: "center", gap: 12,
                    padding: "12px 14px", background: T.surface, border: "none",
                    borderTop: i ? `1px solid ${T.line}` : "none", color: T.ink,
                  }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{s.title}</div>
                    <div style={{ color: T.muted, fontSize: 13 }}>{s.artist}</div>
                  </div>
                  <span style={{ color: T.hot, fontWeight: 700, fontSize: 13 }}>Request →</span>
                </button>
              ))}
            </div>
          )}
          {query && results.length === 0 && !picked && (
            <p style={{ color: T.muted, fontSize: 14, marginTop: 12 }}>
              Nothing matched — try another spelling, or ask the DJ directly.
            </p>
          )}

          {/* Tier sheet */}
          {picked && (
            <div className="rise" style={{ marginTop: 14, borderRadius: 16, border: `1px solid ${T.line}`, background: T.surface, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>{picked.title}</div>
                  <div style={{ color: T.muted, fontSize: 13 }}>{picked.artist}</div>
                </div>
                <button onClick={() => setPicked(null)} style={{ background: "none", border: "none", color: T.muted, fontSize: 13 }}>
                  Cancel
                </button>
              </div>
              <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
                {TIERS.map((t) => (
                  <button key={t.id} onClick={() => submit(t)}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "13px 14px", borderRadius: 12, textAlign: "left",
                      border: t.amount ? "none" : `1px solid ${T.line}`,
                      background: t.amount ? T.grad : "transparent",
                      color: t.amount ? "#1A0A12" : T.ink, fontWeight: 700, fontSize: 15,
                    }}>
                    <span>{t.label}</span>
                    <span style={{ fontWeight: 400, fontSize: 12, opacity: .75 }}>{t.note}</span>
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
                <input
                  value={vipCode} onChange={(e) => setVipCode(e.target.value)}
                  placeholder="Have a VIP code?"
                  style={{ flex: 1, padding: "10px 12px", fontSize: 14, borderRadius: 10, border: `1px solid ${T.line}`, background: T.room, color: T.ink }}
                />
                <span style={{ color: T.muted, fontSize: 11 }}>try VIP2026</span>
              </div>
              <p style={{ color: T.muted, fontSize: 12, marginTop: 12, marginBottom: 0 }}>
                Paid requests are only charged if the DJ plays your song.
              </p>
            </div>
          )}

          {/* Live queue */}
          <section style={{ marginTop: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: T.hot, boxShadow: `0 0 0 3px ${T.hot}22` }} />
              <h2 style={{ margin: 0, fontSize: 13, letterSpacing: ".14em", color: T.muted, fontWeight: 700, textTransform: "uppercase" }}>
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
                {sorted.map((r, i) => (
                  <div key={r.id} className={pulseId === r.id ? "pump" : ""}
                    style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "10px 4px",
                      borderBottom: `1px solid ${T.line}`, background: "transparent",
                    }}>
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700,
                      color: r.vip ? T.warm : T.muted, minWidth: 18, textAlign: "right",
                    }}>
                      {i + 1}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {song(r.songId).title}
                        {r.vip && <span style={{ color: T.warm, fontSize: 10, fontWeight: 700, marginLeft: 8, letterSpacing: ".08em" }}>VIP</span>}
                      </div>
                      <div style={{ color: T.muted, fontSize: 12 }}>
                        {song(r.songId).artist} · {r.count} {r.count === 1 ? "request" : "requests"}
                      </div>
                    </div>
                    {r.amount > 0 && (
                      <span style={{
                        fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 14, color: T.hot,
                      }}>
                        ${r.amount}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {toast && (
            <div className="rise" style={{
              position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)",
              background: T.grad, color: "#1A0A12", fontWeight: 700, fontSize: 14,
              padding: "12px 20px", borderRadius: 99, whiteSpace: "nowrap",
            }}>
              {toast}
            </div>
          )}
        </div>
      ) : (
        /* ══════════ DJ BOOTH — the gear register ══════════ */
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "20px 16px 60px", fontFamily: "'JetBrains Mono', monospace" }}>
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: ".04em" }}>QUEUE // RILEY+SAM RECEPTION</h1>
              <div style={{ color: T.muted, fontSize: 12, marginTop: 4 }}>
                {pending.length} pending · {accepted.length} accepted · {rejected.length} passed
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: T.muted, letterSpacing: ".1em" }}>PAYOUT SO FAR</div>
              <div style={{ fontSize: 26, fontWeight: 700, background: T.grad, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
                ${payout}
              </div>
            </div>
          </header>

          {/* Notification threshold */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: T.surface, border: `1px solid ${T.line}`, marginBottom: 16, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: T.muted }}>Ping me only for requests ≥</span>
            <input type="range" min={0} max={20} step={5} value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))} style={{ accentColor: T.hot }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: T.hot, minWidth: 34 }}>
              {threshold === 0 ? "all" : `$${threshold}`}
            </span>
            <span style={{ fontSize: 12, color: T.muted, marginLeft: "auto" }}>
              {alerts} {alerts === 1 ? "alert" : "alerts"} live
            </span>
          </div>

          {/* Queue filter — DJ triage */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: T.muted, letterSpacing: ".08em", marginRight: 2 }}>SHOW</span>
            {[
              ["all", "All"],
              ["vip", "VIP"],
              ["paid", "Paid"],
              ["10plus", "$10+"],
            ].map(([id, label]) => {
              const active = queueFilter === id;
              const n = filterCounts[id];
              return (
                <button key={id} onClick={() => setQueueFilter(id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8,
                    border: `1px solid ${active ? (id === "vip" ? T.warm : T.hot) : T.line}`,
                    background: active ? (id === "vip" ? `${T.warm}1A` : `${T.hot}1A`) : "transparent",
                    color: active ? T.ink : T.muted, fontWeight: 700, fontSize: 12, fontFamily: "inherit",
                  }}>
                  {label}
                  <span style={{ fontSize: 10, color: active ? (id === "vip" ? T.warm : T.hot) : T.muted }}>{n}</span>
                </button>
              );
            })}
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {djQueue.length === 0 && (
              <p style={{ color: T.muted, fontSize: 13 }}>
                {sorted.length === 0
                  ? "Queue is clear. Requests land here as the crowd scans the QR."
                  : `No ${queueFilter === "vip" ? "VIP" : queueFilter === "paid" ? "paid" : queueFilter === "10plus" ? "$10+" : ""} requests right now — switch back to All.`}
              </p>
            )}
            {djQueue.map((r) => {
              const s = song(r.songId);
              const hot = r.amount >= threshold && threshold > 0;
              return (
                <div key={r.id} className={pulseId === r.id ? "pump" : ""}
                  style={{
                    display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderRadius: 10,
                    background: T.surface,
                    border: `1px solid ${r.vip ? T.warm : hot ? T.hot : T.line}`,
                  }}>
                  <div style={{ minWidth: 52, textAlign: "right" }}>
                    <div style={{ fontSize: 17, fontWeight: 700, color: r.amount ? T.ink : T.muted }}>
                      {r.amount ? `$${r.amount}` : "free"}
                    </div>
                    <div style={{ fontSize: 10, color: T.muted }}>×{r.count}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {s.title}
                      {r.vip && <span style={{ color: T.warm, marginLeft: 8, fontSize: 11 }}>★ VIP</span>}
                    </div>
                    <div style={{ fontSize: 12, color: T.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {s.artist} · {s.bpm} BPM · {r.names.join(", ")}
                    </div>
                  </div>
                  <button onClick={() => decide(r.id, "accepted")}
                    style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: T.grad, color: "#1A0A12", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}>
                    PLAY
                  </button>
                  <button onClick={() => decide(r.id, "rejected")}
                    style={{ padding: "9px 12px", borderRadius: 8, border: `1px solid ${T.line}`, background: "transparent", color: T.muted, fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}>
                    PASS
                  </button>
                </div>
              );
            })}
          </div>

          {/* Decided */}
          {(accepted.length > 0 || rejected.length > 0) && (
            <section style={{ marginTop: 24 }}>
              <h2 style={{ fontSize: 11, letterSpacing: ".14em", color: T.muted, fontWeight: 700 }}>DECIDED</h2>
              <div style={{ display: "grid", gap: 6 }}>
                {[...accepted, ...rejected].map((r) => (
                  <div key={r.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "8px 14px", borderRadius: 8, background: T.room, border: `1px solid ${T.line}`, opacity: .8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: r.status === "accepted" ? T.warm : T.muted, minWidth: 70 }}>
                      {r.status === "accepted" ? "PLAYED" : "REFUNDED"}
                    </span>
                    <span style={{ fontSize: 13, flex: 1 }}>{song(r.songId).title}</span>
                    <span style={{ fontSize: 13, color: r.status === "accepted" ? T.ink : T.muted, textDecoration: r.status === "rejected" ? "line-through" : "none" }}>
                      {r.amount ? `$${r.amount}` : "—"}
                    </span>
                  </div>
                ))}
              </div>
              {rejected.some((r) => r.amount > 0) && (
                <p style={{ fontSize: 11, color: T.muted, marginTop: 8 }}>
                  Passed requests release the card hold automatically — no charge, no refund to process.
                </p>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
