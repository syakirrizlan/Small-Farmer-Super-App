import { lazy, Suspense } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import ModulePage from "./pages/ModulePage";
import ModulesIndex from "./pages/ModulesIndex";
import Settings from "./pages/Settings";
import OnlineBadge from "./components/OnlineBadge";

// Loaded on demand so the AI SDK isn't part of the first download.
const Assistant = lazy(() => import("./pages/Assistant"));

const NAV = [
  { to: "/", label: "Home", icon: "🏡" },
  { to: "/track", label: "Track", icon: "📋" },
  { to: "/assistant", label: "Assistant", icon: "🤖" },
  { to: "/settings", label: "Settings", icon: "⚙️" },
];

export default function App() {
  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand">🌾 Small Farmer</span>
        <OnlineBadge />
      </header>
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/track" element={<ModulesIndex />} />
          <Route path="/track/:moduleId" element={<ModulePage />} />
          <Route path="/assistant" element={<Suspense fallback={<p>Loading…</p>}><Assistant /></Suspense>} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<p>Page not found.</p>} />
        </Routes>
      </main>
      <nav className="tabbar">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === "/"} className="tab">
            <span aria-hidden>{n.icon}</span>
            <small>{n.label}</small>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
