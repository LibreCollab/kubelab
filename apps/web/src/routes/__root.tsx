import { Link, Outlet } from "@tanstack/react-router";

import { useProgress } from "../lib/progress-context";

export function RootLayout() {
  const { xp, streak } = useProgress();

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            K
          </span>
          <span>Kubelab</span>
        </Link>
        <nav className="site-nav" aria-label="Main">
          <span className="header-stat" title="Total XP">
            {xp} XP
          </span>
          <span className="header-stat" title="Current streak">
            {streak}d streak
          </span>
          <Link to="/" activeProps={{ className: "is-active" }}>
            Roadmap
          </Link>
          <Link to="/practice" activeProps={{ className: "is-active" }}>
            Practice
          </Link>
          <span className="badge badge-muted">pre-alpha</span>
        </nav>
      </header>
      <main id="main" className="site-main">
        <Outlet />
      </main>
      <footer className="site-footer">
        <span>Built by LibreCollab</span>
        <span>Apache-2.0</span>
      </footer>
    </div>
  );
}
