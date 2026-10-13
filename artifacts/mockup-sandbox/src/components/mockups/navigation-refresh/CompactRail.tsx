import "./_group.css";
import "./CompactRail.css";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeftRight,
  BookOpen,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Command,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { PreviewContent } from "./_shared/PreviewContent";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: Wallet, label: "Accounts", href: "/accounts" },
  { icon: TrendingUp, label: "Investments", href: "/investments" },
  { icon: ArrowLeftRight, label: "Transfers", href: "/transfers" },
  { icon: CreditCard, label: "Transaction history", href: "/transactions" },
  { icon: BookOpen, label: "Education", href: "/education" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export function CompactRail() {
  const [location, setLocation] = useState("/dashboard");
  const [desktopRailOpen, setDesktopRailOpen] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const mobilePanelRef = useRef<HTMLElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const desktopTriggerRef = useRef<HTMLButtonElement>(null);

  const closeMobile = () => {
    setMobileOpen(false);
    mobileTriggerRef.current?.focus();
  };

  const navigate = (href: string) => {
    setLocation(href);
    const focusTarget = mobileOpen ? mobileTriggerRef : desktopRailOpen ? desktopTriggerRef : null;
    setDesktopRailOpen(false);
    setLabelsOpen(false);
    setMobileOpen(false);
    setDetailsOpen(false);
    focusTarget?.current?.focus();
  };

  useEffect(() => {
    if (!mobileOpen && !desktopRailOpen && !detailsOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (mobileOpen) closeMobile();
        else if (desktopRailOpen) desktopTriggerRef.current?.focus();
        setDesktopRailOpen(false);
        setMobileOpen(false);
        setDetailsOpen(false);
        setLabelsOpen(false);
        return;
      }
      if (event.key === "Tab" && mobileOpen) {
        const focusable = mobilePanelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable?.length) {
          event.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!mobilePanelRef.current?.contains(document.activeElement)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        } else if (event.shiftKey && (document.activeElement === first || document.activeElement === mobilePanelRef.current)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen, desktopRailOpen, detailsOpen]);

  useEffect(() => {
    if (mobileOpen) {
      mobilePanelRef.current
        ?.querySelector<HTMLElement>('button:not([disabled]), a[href]')
        ?.focus();
    }
  }, [mobileOpen]);

  const activeLabel = navItems.find((item) => item.href === location)?.label ?? "Dashboard";

  return (
    <div className="cr-shell">
      <aside
        id="cr-desktop-navigation"
        className={`cr-rail ${desktopRailOpen ? "cr-rail--open" : "cr-rail--closed"} ${labelsOpen ? "cr-rail--labeled" : ""}`}
        aria-label="Primary navigation"
        aria-hidden={!desktopRailOpen}
      >
        <div className="cr-brand">
          <div className="cr-brand-mark">
            <img src="/__mockup/images/veritas-logo.jpeg" alt="" />
          </div>
          {labelsOpen && (
            <div className="cr-brand-copy">
              <strong>Veritas</strong>
              <span>Wealth management</span>
            </div>
          )}
        </div>
        <button
          type="button"
          className="cr-rail-toggle"
          aria-label={labelsOpen ? "Collapse navigation labels" : "Show navigation labels"}
          aria-expanded={labelsOpen}
          aria-controls="cr-desktop-navigation"
          onClick={() => setLabelsOpen((open) => !open)}
          title={labelsOpen ? "Collapse labels" : "Show labels"}
        >
          {labelsOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
          {labelsOpen && <span>Collapse</span>}
        </button>

        <nav className="cr-nav" aria-label="Account pages">
          <p className="cr-nav-caption">{labelsOpen ? "Your account" : <span className="sr-only">Your account</span>}</p>
          {navItems.map((item) => {
            const active = location === item.href;
            return (
              <button
                type="button"
                key={item.href}
                className={`cr-nav-item ${active ? "is-active" : ""}`}
                onClick={() => navigate(item.href)}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                title={labelsOpen ? undefined : item.label}
                data-funds-action={["/transfers", "/investments"].includes(item.href) ? "" : undefined}
              >
                <item.icon aria-hidden="true" />
                {labelsOpen && <span>{item.label}</span>}
                {labelsOpen && active && <span className="cr-current-mark" aria-hidden="true" />}
              </button>
            );
          })}
        </nav>

        <div className="cr-rail-bottom">
          <a
            className="cr-nav-item cr-contact"
            href="mailto:veritaswealth@accountant.com"
            aria-label="Email your advisor"
            title={labelsOpen ? undefined : "Email your advisor"}
          >
            <CircleHelp aria-hidden="true" />
            {labelsOpen && <span>Advisor contact</span>}
          </a>
          <div className="cr-client">
            <div className="cr-avatar" aria-hidden="true">AM</div>
            {labelsOpen && (
              <div className="cr-client-copy">
                <strong>Alex Morgan</strong>
                <span>Private client</span>
              </div>
            )}
            <button
              className="cr-signout"
              type="button"
              aria-label="Sign out"
              title="Sign out"
              onClick={() => navigate("/signed-out")}
            >
              <LogOut aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <button
          className="cr-backdrop"
          type="button"
          aria-label="Close navigation"
          onClick={closeMobile}
        />
      )}
      <aside
        id="cr-mobile-navigation"
        ref={mobilePanelRef}
        className={`cr-mobile-drawer ${mobileOpen ? "is-open" : ""}`}
        aria-label="Mobile navigation"
        aria-hidden={!mobileOpen}
        inert={!mobileOpen}
        tabIndex={-1}
      >
        <div className="cr-mobile-head">
          <div className="cr-brand-mark"><img src="/__mockup/images/veritas-logo.jpeg" alt="" /></div>
          <div className="cr-brand-copy"><strong>Veritas</strong><span>Wealth management</span></div>
          <button className="cr-icon-button" type="button" aria-label="Close side navigation" onClick={closeMobile}><X /></button>
        </div>
        <p className="cr-mobile-caption">Your account</p>
        <nav className="cr-mobile-nav" aria-label="Account pages">
          {navItems.map((item) => {
            const active = location === item.href;
            return (
              <button
                type="button"
                className={`cr-mobile-item ${active ? "is-active" : ""}`}
                key={item.href}
                aria-current={active ? "page" : undefined}
                onClick={() => navigate(item.href)}
              >
                <item.icon aria-hidden="true" /><span>{item.label}</span>
                {active && <ChevronRight className="cr-mobile-chevron" aria-hidden="true" />}
              </button>
            );
          })}
        </nav>
        <div className="cr-mobile-bottom">
          <a className="cr-mobile-item" href="mailto:veritaswealth@accountant.com" onClick={closeMobile}>
            <CircleHelp aria-hidden="true" /><span>Advisor contact</span>
          </a>
          <div className="cr-mobile-person">
            <div className="cr-avatar">AM</div><div className="cr-client-copy"><strong>Alex Morgan</strong><span>Private client</span></div>
            <button type="button" className="cr-signout" aria-label="Sign out" onClick={() => navigate("/signed-out")}><LogOut /></button>
          </div>
        </div>
      </aside>

      <div className="cr-content">
        <header className="cr-topbar">
          <div className="cr-top-left">
            <button
              type="button"
              className="cr-desktop-menu"
              ref={desktopTriggerRef}
              aria-label={desktopRailOpen ? "Close side navigation" : "Open side navigation"}
              aria-expanded={desktopRailOpen}
              aria-controls="cr-desktop-navigation"
              onClick={() => {
                const nextOpen = !desktopRailOpen;
                setDesktopRailOpen(nextOpen);
                if (!nextOpen) setLabelsOpen(false);
              }}
              title={desktopRailOpen ? "Close menu" : "Open menu"}
            >
              {desktopRailOpen ? <PanelLeftClose aria-hidden="true" /> : <Menu aria-hidden="true" />}
              <span>Menu</span>
            </button>
            <button
              type="button"
              className="cr-mobile-menu cr-icon-button"
              ref={mobileTriggerRef}
              aria-label={mobileOpen ? "Close side navigation" : "Open side navigation"}
              aria-expanded={mobileOpen}
              aria-controls="cr-mobile-navigation"
              onClick={() => setMobileOpen((open) => !open)}
            >
              {mobileOpen ? <X /> : <Menu />}
            </button>
            <span className="cr-top-kicker">VERITAS / CLIENT PORTAL</span>
            <span className="cr-top-separator">/</span>
            <span className="cr-top-route">{activeLabel}</span>
          </div>
          <button
            type="button"
            className="cr-details-toggle"
            aria-label={detailsOpen ? "Hide navigation details" : "Show navigation details"}
            aria-expanded={detailsOpen}
            aria-controls="cr-top-details"
            onClick={() => setDetailsOpen((open) => !open)}
          >
            <Command aria-hidden="true" />
            <span>{detailsOpen ? "Hide details" : "Navigation"}</span>
            <ChevronDown className={detailsOpen ? "is-rotated" : ""} aria-hidden="true" />
          </button>
          {detailsOpen && (
            <div className="cr-top-details" id="cr-top-details">
              <span><i /> Secure client access</span>
              <button type="button" onClick={() => navigate("/settings")}><Settings /> Settings</button>
            </div>
          )}
        </header>
        <main className="cr-main">
          <PreviewContent location={location} />
        </main>
        <footer className="cr-footer"><span>Veritas Wealth</span><span>Private client portal · Secure access</span></footer>
      </div>
    </div>
  );
}
