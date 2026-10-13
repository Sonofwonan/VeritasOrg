import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  ArrowLeftRight, BookOpen, ChartNoAxesCombined, ChevronDown, ChevronRight,
  CircleHelp, Clock3, LayoutDashboard, LogOut, Mail, Menu, Settings, Wallet, X,
} from "lucide-react";
import { useEffect, useRef } from "react";
import "./slide-out-navigation.css";

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

type Props = {
  location: string;
  name?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detailsOpen: boolean;
  onDetailsChange: (open: boolean) => void;
  onNavigate: (href: string) => void;
  onSignOut: () => void;
  signingOut: boolean;
};

export function SlideOutNavigation(props: Props) {
  const { location, name, open, onOpenChange, detailsOpen, onDetailsChange, onNavigate, onSignOut, signingOut } = props;
  const previousLocation = useRef(location);
  const detailsToggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (previousLocation.current !== location) {
      previousLocation.current = location;
      onOpenChange(false);
      onDetailsChange(false);
    }
  }, [location, onOpenChange, onDetailsChange]);
  const navigate = (href: string) => {
    onOpenChange(false);
    onDetailsChange(false);
    onNavigate(href);
  };
  const links = (routes: typeof accountRoutes) => routes.map(item => {
    const active = location === item.href || location.startsWith(item.href + "/");
    return (
      <button key={item.href} type="button" className={`qd-link${active ? " qd-link-active" : ""}`}
        aria-current={active ? "page" : undefined} onClick={() => navigate(item.href)}
        data-funds-action={["/transfers", "/investments"].includes(item.href) ? "" : undefined}>
        <item.icon size={19} strokeWidth={1.8} aria-hidden="true" />
        <span>{item.label}</span>
        {active && <span className="qd-current-dot" aria-hidden="true" />}
      </button>
    );
  });
  const pageLabel = [...accountRoutes, ...personalRoutes].find(item =>
    location === item.href || location.startsWith(item.href + "/"))?.label ?? "Client portal";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <header className="qd-topbar">
        <div className="qd-topbar-left">
          <DialogPrimitive.Trigger asChild>
            <button type="button" className="qd-menu-button" data-testid="sidebar-toggle" aria-label="Open menu" aria-controls="veritas-side-navigation">
              <Menu size={19} aria-hidden="true" /><span>Menu</span>
            </button>
          </DialogPrimitive.Trigger>
          <div className="qd-breadcrumb">
            <span className="qd-breadcrumb-label">VERITAS WEALTH</span>
            <ChevronRight size={14} aria-hidden="true" />
            <span className="qd-breadcrumb-current">{pageLabel}</span>
          </div>
        </div>
        <button ref={detailsToggle} type="button" className="qd-details-toggle" data-testid="top-navigation-toggle"
          aria-label={detailsOpen ? "Hide navigation details" : "Show navigation details"}
          aria-expanded={detailsOpen} aria-controls="veritas-top-navigation-actions"
          onClick={() => onDetailsChange(!detailsOpen)}>
          <span>{detailsOpen ? "Hide details" : "Navigation"}</span>
          <ChevronDown size={15} aria-hidden="true" className={detailsOpen ? "qd-chevron-up" : ""} />
        </button>
        {detailsOpen && (
          <div id="veritas-top-navigation-actions" className="qd-header-details"
            onKeyDown={event => { if (event.key === "Escape") { onDetailsChange(false); detailsToggle.current?.focus(); } }}>
            <span>VERITAS WEALTH</span>
            <button type="button" data-testid="header-settings-button" aria-label="Settings" onClick={() => navigate("/settings")}>
              <Settings size={17} aria-hidden="true" />
            </button>
          </div>
        )}
      </header>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="qd-scrim" data-testid="drawer-scrim" />
        <DialogPrimitive.Content id="veritas-side-navigation" className="qd-drawer" data-testid="sidebar-panel" aria-describedby={undefined}>
          <div className="qd-drawer-head">
            <div className="qd-brand">
              <span className="qd-brand-mark"><img src="/veritas-logo.png" alt="" /></span>
              <span className="qd-brand-copy">
                <DialogPrimitive.Title asChild><strong>Veritas</strong></DialogPrimitive.Title>
                <small>WEALTH MANAGEMENT</small>
              </span>
            </div>
            <DialogPrimitive.Close asChild>
              <button type="button" className="qd-close-button" data-testid="sidebar-close" aria-label="Close menu"><X size={19} aria-hidden="true" /></button>
            </DialogPrimitive.Close>
          </div>
          <nav className="qd-nav" aria-label="Account navigation">
            <p className="qd-section-label">YOUR WEALTH</p>
            <div className="qd-link-list">{links(accountRoutes)}</div>
            <div className="qd-nav-divider" />
            <p className="qd-section-label">PERSONAL</p>
            <div className="qd-link-list">{links(personalRoutes)}</div>
          </nav>
          <section className="qd-advisor" aria-label="Advisor contact">
            <div className="qd-advisor-icon"><CircleHelp size={17} aria-hidden="true" /></div>
            <div className="qd-advisor-copy">
              <span className="qd-advisor-eyebrow">HERE TO HELP</span>
              <a href="mailto:veritaswealth@accountant.com">Contact your advisor</a>
              <span className="qd-advisor-email">veritaswealth@accountant.com</span>
            </div>
            <a className="qd-email-action" href="mailto:veritaswealth@accountant.com" aria-label="Email your advisor"><Mail size={16} aria-hidden="true" /></a>
          </section>
          <div className="qd-profile">
            <div className="qd-avatar" aria-hidden="true">{name?.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("") || "U"}</div>
            <div className="qd-profile-copy"><strong data-testid="text-username">{name}</strong><span>Private client</span></div>
            <button type="button" className="qd-signout" onClick={onSignOut} disabled={signingOut}>
              <LogOut size={16} aria-hidden="true" /><span>{signingOut ? "Signing out…" : "Sign out"}</span>
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
