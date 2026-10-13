import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  ArrowLeftRight, ChartNoAxesCombined, ChevronRight, CircleHelp, Clock3,
  LayoutDashboard, Mail, Menu, Settings, UserRound, Wallet, X,
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
  { icon: Settings, label: "Settings", href: "/settings" },
];

type Props = {
  location: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (href: string) => void;
};

export function SlideOutNavigation({ location, open, onOpenChange, onNavigate }: Props) {
  const previousLocation = useRef(location);
  useEffect(() => {
    if (previousLocation.current !== location) {
      previousLocation.current = location;
      onOpenChange(false);
    }
  }, [location, onOpenChange]);

  const navigate = (href: string) => {
    onOpenChange(false);
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
  const pageLabel = location === "/profile" ? "Profile" : [...accountRoutes, ...personalRoutes].find(item =>
    location === item.href || location.startsWith(item.href + "/"))?.label ?? "Client portal";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <header className="qd-topbar">
        <div className="qd-topbar-left">
          <DialogPrimitive.Trigger asChild>
            <button type="button" className="qd-icon-button" data-testid="sidebar-toggle"
              aria-label="Open menu" aria-controls="veritas-side-navigation">
              <Menu size={20} aria-hidden="true" />
            </button>
          </DialogPrimitive.Trigger>
          <div className="qd-breadcrumb" aria-label={`Current page: ${pageLabel}`}>
            <span className="qd-breadcrumb-label">VERITAS WEALTH</span>
            <ChevronRight size={14} aria-hidden="true" />
            <span className="qd-breadcrumb-current" aria-current="page">{pageLabel}</span>
          </div>
        </div>
        <button type="button" className="qd-icon-button" data-testid="profile-button"
          aria-label="Open profile" onClick={() => navigate("/profile")}>
          <UserRound size={19} aria-hidden="true" />
        </button>
      </header>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="qd-scrim" data-testid="drawer-scrim" />
        <DialogPrimitive.Content id="veritas-side-navigation" className="qd-drawer"
          data-testid="sidebar-panel" aria-describedby={undefined}>
          <div className="qd-drawer-head">
            <div className="qd-brand">
              <span className="qd-brand-mark"><img src="/veritas-logo.png" alt="" /></span>
              <span className="qd-brand-copy">
                <DialogPrimitive.Title asChild><strong>Veritas</strong></DialogPrimitive.Title>
                <small>WEALTH MANAGEMENT</small>
              </span>
            </div>
            <DialogPrimitive.Close asChild>
              <button type="button" className="qd-close-button" data-testid="sidebar-close"
                aria-label="Close menu"><X size={19} aria-hidden="true" /></button>
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
            <a className="qd-email-action" href="mailto:veritaswealth@accountant.com"
              aria-label="Email your advisor"><Mail size={16} aria-hidden="true" /></a>
          </section>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
