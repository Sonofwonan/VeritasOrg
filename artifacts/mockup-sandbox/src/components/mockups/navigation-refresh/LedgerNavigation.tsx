import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Command,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Settings,
  ShieldCheck,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";

const sections = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { label: "Accounts", path: "/accounts", icon: Wallet },
  { label: "Investments", path: "/investments", icon: TrendingUp },
  { label: "Transfers", path: "/transfers", icon: ArrowRightLeft },
  { label: "Transaction history", path: "/transactions", icon: BookOpen },
  { label: "Education", path: "/education", icon: CircleHelp },
  { label: "Settings", path: "/settings", icon: Settings },
];

const titles: Record<string, string> = {
  "/dashboard": "Account overview",
  "/accounts": "Your accounts",
  "/investments": "Investments",
  "/transfers": "Transfers",
  "/transactions": "Transaction history",
  "/education": "Education",
  "/settings": "Settings",
  "/signed-out": "Signed out",
};

const ledgerRows = [
  { title: "Transfer received", detail: "Current account  ·  12 Jun 2024", value: "+£2,450.00", positive: true, icon: ArrowDownLeft },
  { title: "Quarterly advisory fee", detail: "Investment account  ·  10 Jun 2024", value: "−£125.00", positive: false, icon: ArrowUpRight },
  { title: "Dividend payment", detail: "Global Equity Fund  ·  07 Jun 2024", value: "+£384.72", positive: true, icon: ArrowDownLeft },
];

export function LedgerNavigation() {
  const [location, setLocation] = useState("/dashboard");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const currentTitle = titles[location] ?? "Account overview";

  const navigate = (path: string) => {
    setLocation(path);
    setDrawerOpen(false);
    setDetailsOpen(false);
    setSignedOut(path === "/signed-out");
  };

  return (
    <div className="ledger-shell">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&display=swap');
        .ledger-shell {
          --paper: #f3f0e8; --surface: #fbfaf6; --surface-deep: #eae5da;
          --ink: #26332e; --muted: #777d72; --line: #ded9cd;
          --pine: #29473b; --pine-dark: #203a31; --brass: #a5814a; --clay: #985849;
          color: var(--ink); background: var(--paper); height: 100%; min-height: 680px;
          width: 100%; overflow: hidden; display: flex; font-family: 'DM Sans', sans-serif;
          font-size: 13px; position: relative;
        }
        .ledger-shell * { box-sizing: border-box; }
        .ledger-sidebar {
          width: 260px; flex: 0 0 260px; background: var(--pine-dark); color: #f4f0e5;
          padding: 27px 18px 17px; display: flex; flex-direction: column; z-index: 5;
          transition: transform .25s ease;
        }
        .ledger-brand { display:flex; align-items:center; gap:12px; padding: 4px 8px 27px; border-bottom:1px solid rgba(239,232,214,.14); }
        .ledger-seal { width:36px; height:36px; border:1px solid #b99a62; color:#d1b77f; display:grid; place-items:center; font-family:'Newsreader',serif; font-size:20px; border-radius:50%; }
        .ledger-brand-name { font:500 20px/1 'Newsreader',serif; letter-spacing:.01em; }
        .ledger-brand-sub { display:block; font:500 8px/1.5 'DM Sans',sans-serif; color:#bdc6b9; letter-spacing:.18em; text-transform:uppercase; margin-top:5px; }
        .ledger-overline { color:#b8c4b7; font-size:9px; letter-spacing:.16em; font-weight:700; text-transform:uppercase; }
        .ledger-support { padding: 23px 6px 21px; border-bottom:1px solid rgba(239,232,214,.14); }
        .ledger-support button { margin-top:11px; height:36px; padding:0 10px; border:1px solid rgba(239,232,214,.19); width:100%; display:flex; align-items:center; gap:9px; background:rgba(255,255,255,.035); color:#f2eee3; font:500 11px 'DM Sans',sans-serif; cursor:pointer; text-align:left; transition:background .18s ease; }
        .ledger-support button:hover { background:rgba(255,255,255,.1); }
        .ledger-nav-label { padding:24px 10px 10px; }
        .ledger-nav { display:grid; gap:3px; }
        .ledger-nav button { position:relative; border:0; background:transparent; color:#d0d5ca; width:100%; min-height:41px; display:flex; align-items:center; gap:12px; text-align:left; padding:0 11px; font:500 12px 'DM Sans',sans-serif; cursor:pointer; transition:color .18s,background .18s; }
        .ledger-nav button:hover { background:rgba(255,255,255,.065); color:#fff; }
        .ledger-nav button.active { color:#fff8e9; background:rgba(222,205,163,.12); }
        .ledger-nav button.active:before { content:''; position:absolute; left:0; top:9px; bottom:9px; width:2px; background:#c3a66c; }
        .ledger-nav button.active svg { color:#d4ba83; }
        .ledger-nav button span { flex:1; }
        .ledger-nav button .nav-chevron { opacity:0; }
        .ledger-nav button:hover .nav-chevron { opacity:.62; }
        .ledger-profile { margin-top:auto; padding:13px 4px 3px; border-top:1px solid rgba(239,232,214,.14); }
        .ledger-person { display:flex; align-items:center; gap:10px; padding:8px 6px 13px; }
        .ledger-avatar { width:34px; height:34px; display:grid; place-items:center; border:1px solid #b99a62; border-radius:50%; color:#e3c98e; font:500 13px 'Newsreader',serif; }
        .ledger-person-name { color:#f7f2e8; font-weight:600; font-size:11px; }
        .ledger-person-role { color:#b8c4b7; font-size:9px; margin-top:3px; letter-spacing:.06em; }
        .ledger-logout { margin-left:auto; border:0; color:#c6cec4; background:transparent; padding:7px; cursor:pointer; }
        .ledger-logout:hover { color:#f1bd9c; }
        .ledger-workspace { min-width:0; flex:1; display:flex; flex-direction:column; }
        .ledger-topbar { height:58px; background:rgba(251,250,246,.88); display:flex; align-items:center; justify-content:space-between; padding:0 31px; border-bottom:1px solid var(--line); flex-shrink:0; }
        .ledger-top-left { display:flex; align-items:center; gap:13px; min-width:0; }
        .ledger-menu-btn { height:34px; width:34px; display:grid; place-items:center; border:1px solid var(--line); background:transparent; color:var(--ink); cursor:pointer; }
        .ledger-crumb-toggle { height:32px; padding:0 10px; display:flex; align-items:center; gap:8px; border:1px solid var(--line); background:var(--surface); color:#626e64; cursor:pointer; text-transform:uppercase; font-size:9px; letter-spacing:.1em; font-weight:700; }
        .ledger-crumb { display:flex; align-items:center; gap:8px; color:#8b8c7f; min-width:0; font-size:11px; }
        .ledger-crumb strong { color:var(--ink); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:600; text-transform:capitalize; }
        .ledger-header-action { background:transparent; border:0; color:#616e63; padding:8px; cursor:pointer; }
        .ledger-header-action:hover { color:var(--pine); }
        .ledger-top-details { background:#ede8dc; border-bottom:1px solid var(--line); display:flex; align-items:center; gap:9px; padding:9px 31px; color:#777a6e; font-size:10px; }
        .ledger-top-details strong { font-weight:600; color:#445349; }
        .ledger-main { padding:27px clamp(19px,4vw,52px) 35px; overflow:auto; flex:1; }
        .ledger-content { max-width:970px; margin:0 auto; }
        .ledger-page-head { display:flex; align-items:flex-end; justify-content:space-between; gap:16px; border-bottom:1px solid var(--line); padding-bottom:17px; margin-bottom:20px; }
        .ledger-eyebrow { display:flex; align-items:center; gap:8px; text-transform:uppercase; font-size:9px; font-weight:700; color:var(--brass); letter-spacing:.16em; margin:0 0 7px; }
        .ledger-eyebrow:before { content:''; width:18px; height:1px; background:var(--brass); }
        .ledger-title { font:400 clamp(27px,3vw,38px)/1 'Newsreader',serif; letter-spacing:-.025em; margin:0; color:#25352e; }
        .ledger-owner { font-size:10px; color:#757c71; text-align:right; white-space:nowrap; }
        .ledger-secure { display:inline-flex; gap:5px; align-items:center; color:#4d6c58; margin-top:6px; font-size:9px; }
        .ledger-balance { position:relative; overflow:hidden; padding:24px 27px 20px; color:#f6f1e6; background:#29473b; min-height:181px; margin-bottom:17px; }
        .ledger-balance:after { content:''; position:absolute; width:255px; height:255px; border:1px solid rgba(209,183,127,.22); border-radius:50%; right:-85px; top:-118px; box-shadow:0 0 0 18px rgba(209,183,127,.035),0 0 0 42px rgba(209,183,127,.025); }
        .ledger-balance-label { color:#d2d6c8; text-transform:uppercase; letter-spacing:.16em; font-size:9px; font-weight:600; }
        .ledger-total { font:400 clamp(31px,4vw,43px)/1.08 'Newsreader',serif; margin:10px 0 15px; letter-spacing:-.02em; }
        .ledger-balance-foot { border-top:1px solid rgba(245,239,222,.2); padding-top:13px; display:flex; gap:30px; color:#d2d6c8; font-size:10px; }
        .ledger-balance-foot span strong { color:#fff4d9; display:block; font:500 15px 'DM Mono',monospace; margin-bottom:3px; }
        .ledger-mini-stat { position:absolute; right:27px; bottom:22px; z-index:1; text-align:right; color:#cdd5c9; font-size:9px; }
        .ledger-mini-stat b { display:block; color:#dfc58f; font:500 12px 'DM Mono',monospace; margin-bottom:4px; }
        .ledger-lower { display:grid; grid-template-columns:minmax(0,1.7fr) minmax(205px,.8fr); gap:16px; }
        .ledger-card { border:1px solid var(--line); background:var(--surface); }
        .ledger-card-head { display:flex; justify-content:space-between; align-items:center; padding:14px 17px; border-bottom:1px solid var(--line); }
        .ledger-card-head h2 { margin:0; font:500 20px/1 'Newsreader',serif; }
        .ledger-text-button { border:0; padding:4px 0; background:none; color:#48604f; display:flex; align-items:center; gap:4px; font:600 9px 'DM Sans',sans-serif; cursor:pointer; }
        .ledger-text-button:hover { color:#9a7042; }
        .ledger-transaction { min-height:57px; display:flex; align-items:center; gap:11px; padding:9px 15px; border-bottom:1px solid #ebe7de; }
        .ledger-transaction:last-child { border-bottom:0; }
        .ledger-transaction-icon { width:30px; height:30px; display:grid; place-items:center; background:#eeece3; color:#657569; }
        .ledger-transaction-copy { min-width:0; flex:1; }
        .ledger-transaction-copy strong { display:block; font-size:10px; font-weight:600; }
        .ledger-transaction-copy small { color:#898b7f; display:block; font-size:9px; margin-top:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .ledger-amount { font:500 10px 'DM Mono',monospace; white-space:nowrap; }
        .ledger-amount.positive { color:#43694d; }
        .ledger-amount.negative { color:#8b5a4b; }
        .ledger-aside { padding:16px; }
        .ledger-aside h3 { margin:0 0 13px; font:500 19px 'Newsreader',serif; }
        .ledger-account { padding:10px 0; border-top:1px solid #e7e2d8; display:flex; justify-content:space-between; gap:8px; align-items:center; }
        .ledger-account-label { color:#727a70; font-size:9px; }
        .ledger-account b { display:block; margin-top:4px; color:#32443a; font:500 12px 'DM Mono',monospace; }
        .ledger-account-icon { width:29px; height:29px; border:1px solid var(--line); color:#68786a; display:grid; place-items:center; }
        .ledger-quiet-link { width:100%; border:1px solid #d7d1c4; background:transparent; margin-top:8px; height:32px; color:#4b5d50; font-size:9px; font-weight:600; letter-spacing:.03em; cursor:pointer; }
        .ledger-quiet-link:hover { background:#f1eee5; }
        .ledger-signed { border:1px solid var(--line); background:var(--surface); padding:30px; }
        .ledger-signed h2 { font:400 31px 'Newsreader',serif; margin:0 0 7px; }
        .ledger-signed p { color:var(--muted); }
        .ledger-overlay { display:none; }
        @media (max-width: 760px) {
          .ledger-shell { min-height:100dvh; }
          .ledger-sidebar { position:absolute; inset:0 auto 0 0; width:min(280px,84vw); transform:translateX(-102%); box-shadow:12px 0 35px rgba(19,33,25,.16); }
          .ledger-sidebar.mobile-open { transform:translateX(0); }
          .ledger-overlay.visible { display:block; position:absolute; inset:0; background:rgba(28,40,32,.3); z-index:4; }
          .ledger-topbar { padding:0 14px; }
          .ledger-main { padding:21px 15px 26px; }
          .ledger-page-head { align-items:flex-start; }
          .ledger-lower { grid-template-columns:1fr; }
          .ledger-mini-stat { right:19px; bottom:17px; }
          .ledger-balance { padding:21px 19px 18px; }
          .ledger-balance-foot { gap:18px; }
          .ledger-top-details { padding:9px 15px; }
          .ledger-owner { font-size:9px; }
        }
        @media (max-width: 450px) {
          .ledger-crumb { display:none; }
          .ledger-balance-foot span:nth-child(3) { display:none; }
          .ledger-mini-stat { position:static; text-align:left; margin-top:12px; }
          .ledger-balance { min-height:0; }
          .ledger-balance-foot { padding-top:10px; }
          .ledger-owner { max-width:85px; white-space:normal; }
        }
      `}</style>

      <button className={`ledger-overlay ${drawerOpen ? "visible" : ""}`} aria-label="Close navigation" onClick={() => setDrawerOpen(false)} />
      <aside className={`ledger-sidebar ${drawerOpen ? "mobile-open" : ""}`} aria-label="Main navigation">
        <div className="ledger-brand">
          <div className="ledger-seal" aria-hidden="true">V</div>
          <div><div className="ledger-brand-name">Veritas</div><span className="ledger-brand-sub">Wealth Management</span></div>
        </div>
        <div className="ledger-support">
          <div className="ledger-overline">Your relationship team</div>
          <button onClick={() => window.location.href = "mailto:veritaswealth@accountant.com"}>
            <Mail size={14} strokeWidth={1.7} /><span>Contact your adviser</span><ChevronRight size={13} style={{ marginLeft: "auto" }} />
          </button>
        </div>
        <div className="ledger-nav-label ledger-overline">Your account</div>
        <nav className="ledger-nav">
          {sections.map(({ label, path, icon: Icon }) => (
            <button key={path} className={location === path ? "active" : ""} onClick={() => navigate(path)} aria-current={location === path ? "page" : undefined}>
              <Icon size={16} strokeWidth={1.7} /><span>{label}</span><ChevronRight className="nav-chevron" size={13} />
            </button>
          ))}
        </nav>
        <div className="ledger-profile">
          <div className="ledger-person">
            <div className="ledger-avatar">AM</div>
            <div><div className="ledger-person-name">Alex Morgan</div><div className="ledger-person-role">Private client</div></div>
            <button className="ledger-logout" aria-label="Sign out" title="Sign out" onClick={() => navigate("/signed-out")}><LogOut size={15} /></button>
          </div>
        </div>
      </aside>
      <div className="ledger-workspace">
        <header className="ledger-topbar">
          <div className="ledger-top-left">
            <button className="ledger-menu-btn" onClick={() => setDrawerOpen((value) => !value)} aria-label={drawerOpen ? "Close side navigation" : "Open side navigation"} aria-expanded={drawerOpen}>
              {drawerOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
            <button className="ledger-crumb-toggle" onClick={() => setDetailsOpen((value) => !value)} aria-expanded={detailsOpen}>
              <Command size={13} /> <span className="wide-label">Navigation</span><ChevronDown size={12} />
            </button>
            <div className="ledger-crumb"><span>Portal</span><ChevronRight size={12} /><strong>{location.slice(1)}</strong></div>
          </div>
          <button className="ledger-header-action" aria-label="Settings" title="Settings" onClick={() => navigate("/settings")}><Settings size={16} /></button>
        </header>
        {detailsOpen && <div className="ledger-top-details"><ShieldCheck size={13} /><span>Secure client portal</span><span>·</span><strong>Private banking services</strong></div>}
        <main className="ledger-main">
          <div className="ledger-content">
            <div className="ledger-page-head">
              <div><p className="ledger-eyebrow">Private client portal</p><h1 className="ledger-title">{currentTitle}</h1></div>
              <div className="ledger-owner">Welcome back, Alex<div className="ledger-secure"><ShieldCheck size={11} /> Your account is secure</div></div>
            </div>
            {signedOut ? (
              <div className="ledger-signed"><h2>Session ended</h2><p>You have signed out of the Veritas client portal.</p><button className="ledger-quiet-link" onClick={() => navigate("/dashboard")}>Return to account overview</button></div>
            ) : (
              <>
                <section className="ledger-balance" aria-label="Total balance">
                  <div className="ledger-balance-label">Total relationship balance</div>
                  <div className="ledger-total">£248,500.25</div>
                  <div className="ledger-balance-foot">
                    <span><strong>03</strong>Accounts</span>
                    <span><strong>02</strong>Investments</span>
                    <span><strong>01</strong>Open transfer</span>
                  </div>
                  <div className="ledger-mini-stat"><b>+2.8%</b>change this quarter</div>
                </section>
                <div className="ledger-lower">
                  <section className="ledger-card">
                    <div className="ledger-card-head"><h2>Recent activity</h2><button className="ledger-text-button" onClick={() => navigate("/transactions")}>All transactions <ChevronRight size={13} /></button></div>
                    {ledgerRows.map(({ title, detail, value, positive, icon: Icon }) => (
                      <div className="ledger-transaction" key={title}>
                        <div className="ledger-transaction-icon"><Icon size={15} strokeWidth={1.7} /></div>
                        <div className="ledger-transaction-copy"><strong>{title}</strong><small>{detail}</small></div>
                        <div className={`ledger-amount ${positive ? "positive" : "negative"}`}>{value}</div>
                      </div>
                    ))}
                  </section>
                  <section className="ledger-card ledger-aside">
                    <h3>Account summary</h3>
                    <div className="ledger-account">
                      <div><div className="ledger-account-label">Current account</div><b>£18,420.65</b></div><div className="ledger-account-icon"><CreditCard size={14} /></div>
                    </div>
                    <div className="ledger-account">
                      <div><div className="ledger-account-label">Investment portfolio</div><b>£230,079.60</b></div><div className="ledger-account-icon"><TrendingUp size={14} /></div>
                    </div>
                    <button className="ledger-quiet-link" onClick={() => navigate("/accounts")}>View your accounts</button>
                  </section>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
