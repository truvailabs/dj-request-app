import { useState } from "react";
import { supabase } from "../lib/supabase";
import { T } from "../lib/theme";

export default function DjLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setSubmitting(false);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 14px",
    fontSize: 15,
    borderRadius: 12,
    border: `1px solid ${T.line}`,
    background: T.room,
    color: T.ink,
    marginTop: 10,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.room,
        color: T.ink,
        fontFamily: "'Archivo', 'Helvetica Neue', sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: "100%",
          maxWidth: 360,
          borderRadius: 16,
          border: `1px solid ${T.line}`,
          background: T.surface,
          padding: 24,
        }}
      >
        <h1 style={{ margin: 0, fontWeight: 900, fontSize: 22, letterSpacing: "-.02em" }}>DJ Login</h1>
        <p style={{ margin: "6px 0 0", color: T.muted, fontSize: 13 }}>Booth access only.</p>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          style={inputStyle}
        />

        {error && (
          <p style={{ color: T.hot, fontSize: 13, marginTop: 10, marginBottom: 0 }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: "100%",
            marginTop: 16,
            padding: "13px 14px",
            borderRadius: 12,
            border: "none",
            background: T.grad,
            color: "#1A0A12",
            fontWeight: 700,
            fontSize: 15,
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
