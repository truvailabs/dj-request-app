import { Routes, Route } from "react-router-dom";
import AttendeePage from "./pages/AttendeePage";
import DjLoginPage from "./pages/DjLoginPage";
import DjDashboardPage from "./pages/DjDashboardPage";
import { useDjSession } from "./lib/useDjSession";
import { T } from "./lib/theme";
import "./App.css";

function DjRoute() {
  const { session, loading } = useDjSession();
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: T.room, color: T.muted, padding: 20 }}>Loading…</div>
    );
  }
  return session ? <DjDashboardPage /> : <DjLoginPage />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AttendeePage />} />
      <Route path="/dj" element={<DjRoute />} />
    </Routes>
  );
}
