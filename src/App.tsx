import { lazy, Suspense } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import ModulePage from "./pages/ModulePage";
import ModulesIndex from "./pages/ModulesIndex";
import Settings from "./pages/Settings";
import OnlineBadge from "./components/OnlineBadge";
import LanguageToggle from "./components/LanguageToggle";
import { InstallButton } from "./components/InstallButton";
import { useI18n, type TKey } from "./i18n";

// Loaded on demand so the AI SDK isn't part of the first download.
const Assistant = lazy(() => import("./pages/Assistant"));

const NAV: { to: string; label: TKey; icon: string }[] = [
  { to: "/", label: "nav.home", icon: "🏡" },
  { to: "/track", label: "nav.track", icon: "📋" },
  { to: "/assistant", label: "nav.assistant", icon: "🤖" },
  { to: "/settings", label: "nav.settings", icon: "⚙️" },
];

export default function App() {
  const { t } = useI18n();
  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand">🌾 {t("app.brand")}</span>
        <span className="row">
          <InstallButton />
          <OnlineBadge />
          <LanguageToggle />
        </span>
      </header>
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/track" element={<ModulesIndex />} />
          <Route path="/track/:moduleId" element={<ModulePage />} />
          <Route path="/assistant" element={<Suspense fallback={<p>{t("app.loading")}</p>}><Assistant /></Suspense>} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<p>{t("app.notFound")}</p>} />
        </Routes>
      </main>
      <nav className="tabbar">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === "/"} className="tab">
            <span aria-hidden>{n.icon}</span>
            <small>{t(n.label)}</small>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
