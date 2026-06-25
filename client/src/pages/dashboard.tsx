import { useAccounts, useInvestments, useAccountTransactions } from "@/hooks/use-finances";
import { useLocation } from "wouter";
import { LayoutShell } from "@/components/layout-shell";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  ArrowLeftRight, Clock, Info, ChevronRight, Landmark,
  ShieldCheck, Briefcase, Activity, BarChart3
} from "lucide-react";

// ── Market index data (static realistic) ─────────────────────────────────────
const MARKET_INDICES = [
  { name: 'S&P 500',   value: '5,447.21', change: '+0.38%', up: true },
  { name: 'TSX',       value: '22,183.40', change: '+0.21%', up: true },
  { name: 'NASDAQ',    value: '17,689.50', change: '+0.52%', up: true },
  { name: 'DOW',       value: '39,118.86', change: '-0.11%', up: false },
  { name: 'Gold',      value: '$2,338',    change: '+0.14%', up: true },
  { name: 'CAD/USD',   value: '0.7341',    change: '-0.08%', up: false },
  { name: 'US 10Y',    value: '4.318%',    change: '+2bp',   up: false },
  { name: 'Oil WTI',   value: '$82.14',    change: '+0.62%', up: true },
];

// ── Asset allocation buckets ──────────────────────────────────────────────────
const ALLOCATION = [
  { label: 'Equities',      pct: 48, color: 'bg-emerald-600' },
  { label: 'Fixed Income',  pct: 22, color: 'bg-sky-500' },
  { label: 'Cash',          pct: 18, color: 'bg-amber-500' },
  { label: 'Real Assets',   pct: 8,  color: 'bg-violet-500' },
  { label: 'Alternatives',  pct: 4,  color: 'bg-rose-400' },
];

// ── Quick actions ─────────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { label: 'Transfer',   icon: ArrowLeftRight, href: '/transfers' },
  { label: 'Invest',     icon: TrendingUp,     href: '/investments' },
  { label: 'Accounts',   icon: Landmark,       href: '/accounts' },
  { label: 'Wire',       icon: ArrowUpRight,   href: '/transfers' },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function categoryOf(type: string) {
  const inv = ['Brokerage Account','Traditional IRA','Roth IRA','401(k) / 403(b)','529 Savings Plan'];
  const biz = ['Trust Account','Business Checking','Business Savings'];
  if (inv.includes(type)) return 'investment';
  if (biz.includes(type)) return 'business';
  return 'cash';
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: accounts, isLoading: accountsLoading } = useAccounts();
  const { data: investments, isLoading: investmentsLoading } = useInvestments();
  const [selectedTxn, setSelectedTxn] = useState<any>(null);

  const checkingAccount = accounts?.find(a => a.accountType === 'Checking Account');
  const { data: transactions, isLoading: txnLoading } = useAccountTransactions(checkingAccount?.id || 0);

  const totalBalance   = accounts?.reduce((s, a) => s + Number(a.balance), 0) || 0;
  const cashTotal      = accounts?.filter(a => categoryOf(a.accountType) === 'cash').reduce((s, a) => s + Number(a.balance), 0) || 0;
  const investTotal    = accounts?.filter(a => categoryOf(a.accountType) === 'investment').reduce((s, a) => s + Number(a.balance), 0) || 0;
  const investValue    = investments?.reduce((s, i) => s + Number(i.shares) * Number(i.currentPrice || i.purchasePrice), 0) || 0;
  const dayChange      = totalBalance * 0.0038;
  const ytdGain        = totalBalance * 0.084;

  const pendingBalance = transactions?.filter(t => t.status === 'pending')
    .reduce((s, t) => t.toAccountId === checkingAccount?.id ? s + Number(t.amount) : s - Number(t.amount), 0) || 0;

  const fmt  = (n: number) => `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2 })}`;
  const fmtM = (n: number) => n >= 1e6 ? `$${(n/1e6).toFixed(2)}M` : fmt(n);

  if (accountsLoading || investmentsLoading) {
    return (
      <LayoutShell>
        <div className="space-y-3">
          <Skeleton className="h-44 w-full rounded-sm" />
          <Skeleton className="h-10 w-full rounded-sm" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-sm" />)}
          </div>
        </div>
      </LayoutShell>
    );
  }

  return (
    <LayoutShell>
      <div className="flex flex-col gap-3">

        {/* ── Transaction Detail Dialog ───────────────────────────────────── */}
        <Dialog open={!!selectedTxn} onOpenChange={o => !o && setSelectedTxn(null)}>
          <DialogContent className="sm:max-w-md border-primary/20 bg-[#0B2218] text-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-serif text-xl">
                <Info className="w-4 h-4 text-amber-400" />
                Transaction Detail
              </DialogTitle>
              <DialogDescription className="text-white/40 font-mono text-xs">REF: TXN-{selectedTxn?.id?.toString().padStart(6, '0')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-0 divide-y divide-white/10 py-2">
              {[
                { label: 'Description', val: selectedTxn?.description },
                { label: 'Amount', val: fmt(Number(selectedTxn?.amount)), accent: true },
                { label: 'Status', val: selectedTxn?.status, badge: true },
                { label: 'Type', val: selectedTxn?.transactionType },
                { label: 'Date', val: selectedTxn?.createdAt && format(new Date(selectedTxn.createdAt), 'MMMM d, yyyy · HH:mm') },
              ].map(row => row.val !== undefined && (
                <div key={row.label} className="flex items-center justify-between py-3 text-sm">
                  <span className="text-white/40 label-caps">{row.label}</span>
                  {row.badge ? (
                    <span className={cn('text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm border',
                      selectedTxn?.status === 'pending'
                        ? 'border-amber-500/30 text-amber-400 bg-amber-500/10'
                        : 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                    )}>{row.val}</span>
                  ) : (
                    <span className={cn('font-semibold', row.accent && 'font-mono text-amber-400 text-base')}>{row.val}</span>
                  )}
                </div>
              ))}
            </div>
            {selectedTxn?.status === 'pending' && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-sm mb-2">
                <p className="text-[10px] text-amber-400 uppercase tracking-widest font-black mb-1">Compliance Review</p>
                <p className="text-xs text-white/60 leading-relaxed">This transaction is undergoing institutional verification per FINTRAC requirements and will settle upon clearance.</p>
              </div>
            )}
            <Button onClick={() => setSelectedTxn(null)} className="w-full bg-white text-[#0B2218] hover:bg-white/90 rounded-sm font-bold">Close</Button>
          </DialogContent>
        </Dialog>

        {/* ── Portfolio Header ────────────────────────────────────────────── */}
        <div className="bg-[#0B2218] rounded-sm overflow-hidden">
          <div className="px-8 py-7 border-b border-white/10">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              {/* Net worth */}
              <div>
                <p className="label-caps text-white/40 mb-1">{getGreeting()}, {user?.name?.split(' ')[0]} · Portfolio Overview</p>
                <div className="flex items-end gap-4">
                  <span className="font-serif text-5xl text-white tracking-tight" data-testid="text-net-worth">
                    {fmtM(totalBalance)}
                  </span>
                  <div className="flex items-center gap-1 text-emerald-400 text-sm font-mono mb-1.5">
                    <TrendingUp className="w-3.5 h-3.5" />
                    +{fmt(dayChange)} today
                  </div>
                </div>
                <p className="text-white/30 text-xs font-mono mt-1">
                  Total Net Worth · CAD · {format(new Date(), 'MMMM d, yyyy')}
                </p>
              </div>
              {/* Quick actions */}
              <div className="flex gap-2 shrink-0">
                {QUICK_ACTIONS.map(({ label, icon: Icon, href }) => (
                  <button key={label} onClick={() => setLocation(href)}
                    className="flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-sm bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all group"
                    data-testid={`button-quick-${label.toLowerCase()}`}>
                    <Icon className="w-4 h-4 text-white/60 group-hover:text-white transition-colors" />
                    <span className="text-[9px] uppercase tracking-widest text-white/40 group-hover:text-white/70 transition-colors font-semibold">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-white/10">
            {[
              { label: 'Liquid Cash',    val: fmtM(cashTotal),    sub: pendingBalance !== 0 ? `${fmt(Math.abs(pendingBalance))} pending` : 'Available now', icon: Landmark },
              { label: 'Investments',    val: fmtM(investTotal),  sub: 'Mkt value excl. cash', icon: BarChart3 },
              { label: 'YTD Return',     val: fmt(ytdGain),       sub: '+8.4% vs. benchmark',  icon: TrendingUp },
              { label: 'Portfolio Risk', val: 'Moderate',         sub: 'Risk band: 5 / 10',     icon: ShieldCheck },
            ].map(({ label, val, sub, icon: Icon }) => (
              <div key={label} className="px-6 py-4 flex items-center gap-3">
                <Icon className="w-4 h-4 text-white/20 shrink-0" />
                <div>
                  <p className="label-caps text-white/30 mb-0.5">{label}</p>
                  <p className="font-mono text-white font-semibold text-sm">{val}</p>
                  <p className="text-white/25 text-[10px] mt-0.5">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Market Indices Bar ──────────────────────────────────────────── */}
        <div className="border border-border/60 rounded-sm overflow-hidden">
          <div className="bg-muted/30 px-4 py-1.5 border-b border-border/60 flex items-center gap-2">
            <Activity className="w-3 h-3 text-muted-foreground" />
            <span className="label-caps text-muted-foreground">Market Indices</span>
            <span className="ml-auto text-[9px] text-muted-foreground/50 font-mono">Delayed 15 min · {format(new Date(), 'HH:mm')}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 divide-x divide-y lg:divide-y-0 divide-border/50">
            {MARKET_INDICES.map(idx => (
              <div key={idx.name} className="px-4 py-3">
                <p className="label-caps text-muted-foreground/60 mb-0.5">{idx.name}</p>
                <p className="font-mono text-sm font-semibold text-foreground">{idx.value}</p>
                <p className={cn('text-[10px] font-mono font-bold flex items-center gap-0.5 mt-0.5',
                  idx.up ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500')}>
                  {idx.up ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                  {idx.change}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Main Grid ───────────────────────────────────────────────────── */}
        <div className="grid gap-3 lg:grid-cols-[1fr_360px]">

          {/* Left column: Holdings + Transactions */}
          <div className="flex flex-col gap-3">

            {/* Holdings table */}
            <div className="border border-border/60 rounded-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-border/60 flex items-center justify-between bg-muted/20">
                <div>
                  <p className="font-semibold text-sm">Holdings</p>
                  <p className="text-[10px] text-muted-foreground label-caps mt-0.5">Equity positions in portfolio</p>
                </div>
                <Button variant="ghost" size="sm" className="text-xs text-primary hover:bg-primary/5 gap-1"
                  onClick={() => setLocation('/investments')}>
                  Manage <ChevronRight className="w-3 h-3" />
                </Button>
              </div>

              {/* Table header */}
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_80px] gap-2 px-5 py-2 border-b border-border/40 bg-muted/10">
                {['Security', 'Shares', 'Avg Cost', 'Mkt Value', 'P&L'].map(h => (
                  <p key={h} className="label-caps text-muted-foreground/60 text-right first:text-left">{h}</p>
                ))}
              </div>

              {investmentsLoading ? (
                <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : investments && investments.length > 0 ? (
                <div className="divide-y divide-border/40">
                  {investments.map((inv: any) => {
                    const mktVal = Number(inv.shares) * Number(inv.currentPrice || inv.purchasePrice);
                    const cost   = Number(inv.shares) * Number(inv.purchasePrice);
                    const pnl    = mktVal - cost;
                    const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
                    return (
                      <div key={inv.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_80px] gap-2 px-5 py-3.5 hover:bg-muted/30 transition-colors items-center"
                        data-testid={`holding-row-${inv.id}`}>
                        <div>
                          <p className="font-bold text-sm">{inv.symbol}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{Number(inv.shares).toFixed(4)} sh</p>
                        </div>
                        <p className="font-mono text-xs text-right text-muted-foreground">{fmt(Number(inv.purchasePrice))}</p>
                        <p className="font-mono text-xs text-right font-semibold">{fmt(mktVal)}</p>
                        <p className="font-mono text-xs text-right font-semibold">{fmt(mktVal)}</p>
                        <div className="text-right">
                          <p className={cn('font-mono text-xs font-bold', pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500')}>
                            {pnl >= 0 ? '+' : ''}{fmt(pnl)}
                          </p>
                          <p className={cn('text-[9px] font-mono', pnl >= 0 ? 'text-emerald-500' : 'text-rose-400')}>
                            {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {/* Totals row */}
                  <div className="grid grid-cols-[2fr_1fr_1fr_1fr_80px] gap-2 px-5 py-3 bg-muted/20 items-center border-t border-border">
                    <p className="label-caps text-muted-foreground">Total</p>
                    <p className="text-right" />
                    <p className="text-right" />
                    <p className="font-mono text-sm font-bold text-right">{fmt(investValue)}</p>
                    <p className="text-right">
                      <span className="font-mono text-xs font-bold text-emerald-600">+8.40%</span>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center">
                  <BarChart3 className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No holdings yet</p>
                  <Button size="sm" variant="outline" className="mt-3 rounded-sm text-xs gap-1" onClick={() => setLocation('/investments')}>
                    <TrendingUp className="w-3 h-3" /> Start Investing
                  </Button>
                </div>
              )}
            </div>

            {/* Recent transactions */}
            <div className="border border-border/60 rounded-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-border/60 flex items-center justify-between bg-muted/20">
                <div>
                  <p className="font-semibold text-sm">Recent Activity</p>
                  <p className="text-[10px] text-muted-foreground label-caps mt-0.5">Primary account ledger</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-[9px] text-emerald-600 font-bold uppercase tracking-widest">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
                  </span>
                </div>
              </div>
              <div className="divide-y divide-border/40 max-h-[320px] overflow-y-auto custom-scrollbar">
                {txnLoading ? (
                  <div className="p-4 space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-12" />)}</div>
                ) : transactions && transactions.length > 0 ? transactions.slice(0, 12).map((txn: any) => {
                  const isIn = txn.toAccountId === checkingAccount?.id;
                  const isPending = txn.status === 'pending';
                  return (
                    <div key={txn.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer group"
                      onClick={() => setSelectedTxn(txn)} data-testid={`txn-row-${txn.id}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn('w-8 h-8 rounded-sm flex items-center justify-center shrink-0',
                          isPending ? 'bg-amber-100 dark:bg-amber-900/30' : isIn ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-rose-100 dark:bg-rose-900/30')}>
                          {isPending
                            ? <Clock className="w-3.5 h-3.5 text-amber-600" />
                            : isIn
                              ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                              : <ArrowDownRight className="w-3.5 h-3.5 text-rose-500" />
                          }
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{txn.description}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {format(new Date(txn.createdAt), 'MMM d, yyyy')} ·{' '}
                            <span className={cn('font-bold capitalize',
                              isPending ? 'text-amber-600' : 'text-muted-foreground')}>
                              {txn.status}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <p className={cn('font-mono text-sm font-bold',
                          isPending ? 'text-amber-600' : isIn ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500')}>
                          {isIn ? '+' : '-'}{fmt(Number(txn.amount))}
                        </p>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  );
                }) : (
                  <div className="py-10 text-center">
                    <Clock className="w-7 h-7 text-muted-foreground/20 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No transactions yet</p>
                  </div>
                )}
              </div>
              <button className="w-full px-5 py-2.5 border-t border-border/50 text-[10px] label-caps text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-1"
                onClick={() => setLocation('/transfers')}>
                Full Ledger <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-3">

            {/* Asset allocation */}
            <div className="border border-border/60 rounded-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-border/60 bg-muted/20">
                <p className="font-semibold text-sm">Asset Allocation</p>
                <p className="text-[10px] text-muted-foreground label-caps mt-0.5">Strategic target weights</p>
              </div>
              <div className="px-5 py-4 space-y-4">
                {/* Combined bar */}
                <div className="flex rounded-sm overflow-hidden h-3">
                  {ALLOCATION.map(a => (
                    <div key={a.label} className={cn(a.color, 'h-full')} style={{ width: `${a.pct}%` }} title={`${a.label}: ${a.pct}%`} />
                  ))}
                </div>
                {/* Legend */}
                <div className="space-y-2.5">
                  {ALLOCATION.map(a => (
                    <div key={a.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn('w-2.5 h-2.5 rounded-sm shrink-0', a.color)} />
                        <span className="text-xs text-muted-foreground">{a.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-20 h-1.5 bg-muted rounded-sm overflow-hidden">
                          <div className={cn('h-full', a.color)} style={{ width: `${a.pct}%` }} />
                        </div>
                        <span className="font-mono text-xs font-bold w-8 text-right">{a.pct}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Account summary */}
            <div className="border border-border/60 rounded-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-border/60 bg-muted/20 flex items-center justify-between">
                <p className="font-semibold text-sm">Accounts</p>
                <button className="text-[10px] label-caps text-primary hover:underline" onClick={() => setLocation('/accounts')}>
                  View all
                </button>
              </div>
              <div className="divide-y divide-border/40">
                {accounts?.slice(0, 5).map(acc => {
                  const cat = categoryOf(acc.accountType);
                  return (
                    <div key={acc.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer group"
                      onClick={() => setLocation(`/accounts/${acc.id}`)} data-testid={`dash-account-${acc.id}`}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={cn('w-7 h-7 rounded-sm flex items-center justify-center shrink-0',
                          cat === 'investment' ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                          cat === 'business'   ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-sky-100 dark:bg-sky-900/30')}>
                          {cat === 'investment' ? <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
                          : cat === 'business'  ? <Briefcase className="w-3.5 h-3.5 text-amber-600" />
                          :                       <Landmark className="w-3.5 h-3.5 text-sky-600" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">{acc.accountType}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            ••••{((acc.id * 1337) % 9000 + 1000).toString().slice(-4)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <p className="font-mono text-xs font-bold tabular-nums">
                          ${Number(acc.balance).toLocaleString('en-CA', { minimumFractionDigits: 2 })}
                        </p>
                        <ChevronRight className="w-3 h-3 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Advisory note */}
            <div className="border border-border/60 rounded-sm bg-[#0B2218]/5 dark:bg-[#0B2218]/40 p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-foreground mb-1">Advisory Notice</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Your portfolio is well-diversified within your target risk band. Your advisor recommends reviewing fixed-income allocation given current rate environment.
                  </p>
                  <button className="mt-2 text-[10px] label-caps text-primary hover:underline flex items-center gap-1"
                    onClick={() => setLocation('/goals')}>
                    View Strategy <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 pb-1 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground/40">
          <span className="flex items-center gap-1.5"><ShieldCheck className="w-3 h-3" /> CDIC member · CIPF protected</span>
          <span>All figures in CAD · Data as of {format(new Date(), 'MMM d, yyyy')}</span>
        </div>

      </div>
    </LayoutShell>
  );
}
