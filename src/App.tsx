import { useEffect, useState } from "react";
import { TABS } from "./lib/tabs";
import { Academy } from "./pages/Academy";
import { Advisor } from "./pages/Advisor";
import { Compare } from "./pages/Compare";
import { Overview } from "./pages/Overview";
import { SellerTypes } from "./pages/SellerTypes";
import { SeoLab } from "./pages/SeoLab";
import { ShopStats } from "./pages/ShopStats";
import { StoreProvider, useStore } from "./store";

type Theme = "system" | "light" | "dark";

function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return (localStorage.getItem("sellerscope:theme") as Theme) || "system";
    } catch {
      return "system";
    }
  });
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("sellerscope:theme", theme);
    } catch {
      // ignore
    }
  }, [theme]);
  const next = () => setTheme((t) => (t === "system" ? "light" : t === "light" ? "dark" : "system"));
  return [theme, next];
}

function Shell() {
  const { tab, go, reset } = useStore();
  const [theme, nextTheme] = useTheme();

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand-row">
            <div className="brand">
              <div className="brand-mark" aria-hidden="true">
                S
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="brand-name">SellerScope</div>
                <div className="brand-sub">SEO, stats & study for Etsy sellers</div>
              </div>
            </div>
            <div className="row" style={{ flexWrap: "nowrap" }}>
              <button className="icon-btn" onClick={nextTheme} title={`Theme: ${theme}`} aria-label={`Theme: ${theme}. Click to change.`}>
                {theme === "dark" ? "☾" : theme === "light" ? "☀" : "◐"}
              </button>
            </div>
          </div>
          <nav className="nav" aria-label="Sections">
            {TABS.map((t) => (
              <button key={t.id} aria-current={tab === t.id ? "page" : undefined} onClick={() => go(t.id)}>
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="main">
        {tab === "overview" && <Overview />}
        {tab === "compare" && <Compare />}
        {tab === "seo" && <SeoLab />}
        {tab === "stats" && <ShopStats />}
        {tab === "sellers" && <SellerTypes />}
        {tab === "academy" && <Academy />}
        {tab === "advisor" && <Advisor />}
      </main>

      <footer className="footer">
        SellerScope is an independent study tool and is not affiliated with Etsy, Inc. Your data stays in this browser.{" "}
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => {
            if (confirm("Delete all data saved in this browser (stats, audits, plan, course progress, chat)?")) reset();
          }}
        >
          Reset all data
        </button>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
