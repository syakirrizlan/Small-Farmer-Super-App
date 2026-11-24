import { lazy, Suspense, useEffect, useState } from "react";
import { Link, NavLink, Route, Routes, useLocation, matchPath } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import ModulePage from "./pages/ModulePage";
import ModulesIndex from "./pages/ModulesIndex";
import Settings from "./pages/Settings";
import OnlineBadge from "./components/OnlineBadge";
import LanguageToggle from "./components/LanguageToggle";
import { InstallButton } from "./components/InstallButton";
import Icon, { type IconName } from "./components/Icon";
import { useI18n, type TKey } from "./i18n";
import { moduleTitle } from "./i18n/labels";
import { getModule } from "./db/modules";
import { useMediaQuery, WIDE } from "./lib/useMediaQuery";

// Loaded on demand so the AI SDK isn't part of the first download.
const Assistant = lazy(() => import("./pages/Assistant"));

const NAV: { to: string; label: TKey; icon: IconName }[] = [
  { to: "/", label: "nav.home", icon: "home" },
  { to: "/track", label: "nav.track", icon: "grid" },
  { to: "/assistant", label: "nav.assistant", icon: "sparkles" },
  { to: "/settings", label: "nav.settings", icon: "gear" },
];

/** Compact title for the top bar, shown once the page's Large Title scrolls away. */
function useCompactTitle(): { title: string; back?: string } {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const m = matchPath("/track/:moduleId", pathname);
  if (m) {
    const mod = getModule(m.params.moduleId ?? "");
    return { title: mod ? moduleTitle(mod) : "", back: "/track" };
  }
  const item = NAV.find((n) => n.to === pathname);
  return { title: item ? t(item.label) : "" };
}

function useScrolled(threshold = 36) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > threshold);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [threshold]);
  return scrolled;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  const { t } = useI18n();
  const wide = useMediaQuery(WIDE);
  const scrolled = useScrolled();
  const { title, back } = useCompactTitle();
  const { pathname } = useLocation();

  const routes = (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/track" element={<ModulesIndex />} />
      <Route path="/track/:moduleId" element={<ModulePage />} />
      <Route path="/assistant" element={<Suspense fallback={<p className="muted">{t("app.loading")}</p>}><Assistant /></Suspense>} />
      <Route path="/settings" element={<Settings />} />
      <Route path="*" element={<div className="empty"><Icon name="info" /><h3>{t("app.notFound")}</h3></div>} />
    </Routes>
  );

  if (wide) {
    return (
      <div className="shell wide">
        <ScrollToTop />
        <aside className="sidebar">
          <div className="sidebar-brand">
            <span className="tile tile-lg"><Icon name="leaf" /></span>
            <span className="cell-body">
              <span className="t-headline">{t("app.brand")}</span>
              <span className="t-footnote muted">{t("app.tagline")}</span>
            </span>
          </div>
          <nav className="sidebar-nav" aria-label={t("app.brand")}>
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === "/"} className="tab side-item">
                <Icon name={n.icon} />
                <span>{t(n.label)}</span>
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-foot">
            <OnlineBadge long />
            <InstallButton variant="sidebar" />
            <LanguageToggle />
          </div>
        </aside>
        <main className="content" key={pathname}>{routes}</main>
      </div>
    );
  }

  return (
    <div className="shell">
      <ScrollToTop />
      <header className={`topbar ${scrolled ? "scrolled" : ""}`}>
        <div className="topbar-side">
          {back && (
            <Link to={back} className="topbar-back" aria-label={t("app.back")}>
              <Icon name="chevronLeft" size={26} />
            </Link>
          )}
        </div>
        <span className="topbar-title" aria-hidden={!scrolled}>{title}</span>
        <div className="topbar-side end">
          <OnlineBadge />
          <InstallButton />
          <LanguageToggle />
        </div>
      </header>
      <main className="content" key={pathname}>{routes}</main>
      <nav className="tabbar" aria-label={t("app.brand")}>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === "/"} className="tab">
            <Icon name={n.icon} size={26} />
            <small>{t(n.label)}</small>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
