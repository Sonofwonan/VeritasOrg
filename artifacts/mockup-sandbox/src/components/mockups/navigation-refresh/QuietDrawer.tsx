import "./_group.css";
import "./QuietDrawer.css";
import { PreviewContent } from "./_shared/PreviewContent";
import {
  ArrowLeftRight,
  BookOpen,
  ChartNoAxesCombined,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Settings,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const accountRoutes = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: Wallet, label: "Accounts", href: "/accounts" },
  { icon: ChartNoAxesCombined, label: "Investments", href: "/investments" },
  { icon: ArrowLeftRight, label: "Transfers", href: "/transfers" },
  { icon: Clock3, label: "Transaction history", href: "/transactions" },
];

const personalRoutes = [
  { icon: BookOpen, label: "Education", href: "/education" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export function QuietDrawer() {
  const [location, setLocation] = useState("/dashboard");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const previousLocation = useRef(location);

  useEffect(() => {
    if (previousLocation.current !== location) {
      previousLocation.current = location;
      setDrawerOpen(false);
      setDetailsOpen(false);
    }
  }, [location]);

  useEffect(() => {
    if (!drawerOpen) return;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setDrawerOpen(false);
        menuButtonRef.current?.focus();
        return;
      }
      if (event.key === "Tab" && drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  const navigate = (href: string) => {
    setLocation(href);
    setDrawerOpen(false);
    setDetailsOpen(false);
    window.setTimeout(() => menuButtonRef.current?.focus(), 0);
  };

  const signOut = () => {
    setLocation("/signed-out");
    setDrawerOpen(false);
  };

  const renderLink = (item: (typeof accountRoutes)[number]) => {
    const active = location === item.href;
    const Icon = item.icon;
    return (
      <button
        type="button"
        key={item.href}
        className={`qd-link${active ? " qd-link-active" : ""}`}
        aria-current={active ? "page" : undefined}
        onClick={() => navigate(item.href)}
      >
        <Icon aria-hidden="true" size={19} strokeWidth={1.8} />
        <span>{item.label}</span>
        {active && <span className="qd-current-dot" aria-hidden="true" />}
      </button>
    );
  };

  return (
    <div className="qd-app">
      <header className="qd-topbar">
        <div className="qd-topbar-left">
          <button
            ref={menuButtonRef}
            type="button"
            className="qd-menu-button"
            data-testid="sidebar-toggle"
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            aria-controls="quiet-drawer-panel"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu aria-hidden="true" size={19} />
            <span>Menu</span>
          </button>
          <div className="qd-breadcrumb" aria-live="polite">
            <span className="qd-breadcrumb-label">VERITAS WEALTH</span>
            <ChevronRight aria-hidden="true" size={14} />
            <span className="qd-breadcrumb-current">
              {location === "/dashboard"
                ? "Overview"
                : location === "/signed-out"
                  ? "Signed out"
                  : location.slice(1).replace(/^\w/, (letter) => letter.toUpperCase())}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="qd-details-toggle"
          data-testid="top-navigation-toggle"
          aria-expanded={detailsOpen}
          aria-controls="quiet-header-details"
          onClick={() => setDetailsOpen((open) => !open)}
        >
          <span>{detailsOpen ? "Hide details" : "Navigation"}</span>
          <ChevronDown aria-hidden="true" size={15} className={detailsOpen ? "qd-chevron-up" : ""} />
        </button>
        {detailsOpen && (
          <div id="quiet-header-details" className="qd-header-details">
            <span>VERITAS PRIVATE CLIENT</span>
            <button type="button" onClick={() => navigate("/settings")} aria-label="Go to Settings">
              <Settings size={17} aria-hidden="true" />
            </button>
          </div>
        )}
      </header>

      <main className="qd-main">
        <PreviewContent location={location} />
      </main>

      {drawerOpen && (
        <div
          className="qd-scrim"
          data-testid="drawer-scrim"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setDrawerOpen(false);
              menuButtonRef.current?.focus();
            }
          }}
        >
          <aside
            ref={drawerRef}
            id="quiet-drawer-panel"
            className="qd-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="qd-brand-name"
            data-testid="sidebar-panel"
          >
            <div className="qd-drawer-head">
              <div className="qd-brand">
                <span className="qd-brand-mark">
                  <img src="/__mockup/images/veritas-logo.jpeg" alt="" />
                </span>
                <span className="qd-brand-copy">
                  <strong id="qd-brand-name">Veritas</strong>
                  <small>WEALTH MANAGEMENT</small>
                </span>
              </div>
              <button
                type="button"
                ref={closeButtonRef}
                className="qd-close-button"
                data-testid="sidebar-close"
                aria-label="Close menu"
                onClick={() => {
                  setDrawerOpen(false);
                  menuButtonRef.current?.focus();
                }}
              >
                <X size={19} aria-hidden="true" />
              </button>
            </div>

            <nav className="qd-nav" aria-label="Account navigation">
              <p className="qd-section-label">YOUR WEALTH</p>
              <div className="qd-link-list">{accountRoutes.map(renderLink)}</div>
              <div className="qd-nav-divider" />
              <p className="qd-section-label">PERSONAL</p>
              <div className="qd-link-list">{personalRoutes.map(renderLink)}</div>
            </nav>

            <section className="qd-advisor" aria-label="Advisor contact">
              <div className="qd-advisor-icon"><CircleHelp size={17} aria-hidden="true" /></div>
              <div className="qd-advisor-copy">
                <span className="qd-advisor-eyebrow">HERE TO HELP</span>
                <a href="mailto:veritaswealth@accountant.com">Contact your advisor</a>
                <span className="qd-advisor-email">veritaswealth@accountant.com</span>
              </div>
              <a
                className="qd-email-action"
                href="mailto:veritaswealth@accountant.com"
                aria-label="Email your advisor"
              >
                <Mail size={16} aria-hidden="true" />
              </a>
            </section>

            <div className="qd-profile">
              <div className="qd-avatar" aria-hidden="true">AM</div>
              <div className="qd-profile-copy">
                <strong>Alex Morgan</strong>
                <span>Private client</span>
              </div>
              <button type="button" className="qd-signout" onClick={signOut}>
                <LogOut size={16} aria-hidden="true" />
                <span>Sign out</span>
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
