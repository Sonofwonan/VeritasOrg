import { useInvestments, useAccountTransactions, usePortfolioTransactions } from "@/hooks/use-finances";
import { useLocation } from "wouter";
import { LayoutShell } from "@/components/layout-shell";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { useActiveLiquidation } from "@/hooks/use-liquidation-status";
import {
  TrendingUp, ArrowUpRight, ArrowDownRight,
  ArrowLeftRight, Clock, Info, ChevronRight, Landmark,
  Briefcase, BarChart3, Building2, Lock
} from "lucide-react";
import { transactionDescription, clientBalanceCurrency, formatBalance } from "@shared/balance-currency";
import { useFundsAccess } from "@/hooks/use-funds-access";
import { useClientAccountSnapshot } from "@/hooks/use-fees";
import { DebtAccountSummary } from "@/components/fees/debt-account-summary";
import { DebtRestrictionStatus } from "@/components/fees/debt-restriction-status";
import { accountLabel, transactionDate, maskAccountNumber, TOTAL_OWED_LABEL, type CashPosting } from "@shared/account-display";
import { TransactionAmountBalance } from "@/components/transaction-amount-balance";

// ── Quick actions ─────────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { label: 'Transfer',   icon: ArrowLeftRight, href: '/transfers' },
  { label: 'Invest',     icon: TrendingUp,     href: '/investments' },
  { label: 'Accounts',   icon: Landmark,       href: '/accounts' },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function categoryOf(type: string) {
  const investmentTypes = [
    'Brokerage Account',
    'Traditional IRA',
    'Roth IRA',
    '401(k) / 403(b)',
    '529 Savings Plan',
    'Trust Account',
  ];
  return investmentTypes.includes(type) ? 'investment' : 'investment';
}

export default function DashboardPage() {
  const { user } = useAuth();
  const currency = clientBalanceCurrency(user);
  const access = useFundsAccess();
  const [, setLocation] = useLocation();
  const snapshot = useClientAccountSnapshot();
  const accounts = snapshot.data?.accounts;
  const accountsLoading = snapshot.isLoading;
  const accountsError = snapshot.isError;
  const refetchAccounts = snapshot.refetch;
  const feeSummary = { ...snapshot, data: snapshot.isError ? undefined : snapshot.data?.feeSummary };
  const { data: investments, isLoading: investmentsLoading, isError: investmentsError, refetch: refetchInvestments } = useInvestments();
  const [selectedTxn, setSelectedTxn] = useState<any>(null);
  const { transfers: instTransfers, statusUnavailable } = useActiveLiquidation();

  // Active transfer = any that isn't rejected/completed
  const activeTransfer = instTransfers.find((t: any) =>
    ["pending", "under_review", "approved", "liquidating", "transfer_out"].includes(t.status)
  );
  const isTransmitting = activeTransfer?.status === "transfer_out";

  const primaryAccount = accounts?.find(a => a.accountType === 'Brokerage Account') || accounts?.[0];
  const { data: primaryTransactions } = useAccountTransactions(primaryAccount?.id || 0);
  const { data: transactions, isLoading: txnLoading, isError: txnError } = usePortfolioTransactions();

  const fmt = (n: number | string) => formatBalance(n, currency);
  const investValue    = investments?.reduce((s, i) => s + Number(i.shares) * Number(i.currentPrice ?? i.purchasePrice), 0) ?? 0;
  // Current funded assets, not net worth. Other accounts' debt stays below.
  const cashTotal      = accounts?.reduce((s, a) => s + Math.max(0, Number(a.balance)), 0) ?? 0;
  const overdraftTotal = accounts?.reduce((s, a) => s + Math.max(0, -Number(a.balance)), 0) ?? 0;
  const verifiedDebtAmount = (value: unknown): number | null => {
    if ((typeof value !== "string" && typeof value !== "number") || (typeof value === "string" && !value.trim())) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  };
  const totalUnpaid = verifiedDebtAmount(feeSummary.data?.totalUnpaid);
  const totalOverdraft = feeSummary.data?.totalOverdraft === undefined
    ? accounts && accounts.every(account =>
      (typeof account.balance === "string" ? account.balance.trim() !== "" : typeof account.balance === "number") &&
      Number.isFinite(Number(account.balance)))
      ? accounts.reduce((sum, account) => sum + Math.max(0, -Number(account.balance)), 0)
      : null
    : verifiedDebtAmount(feeSummary.data.totalOverdraft);
  const proposedTotalOwed = feeSummary.data?.totalOwed === undefined
    ? totalUnpaid !== null && totalOverdraft !== null ? totalUnpaid + totalOverdraft : null
    : verifiedDebtAmount(feeSummary.data.totalOwed);
  const suppliedOverdraftInvalid = feeSummary.data?.totalOverdraft !== undefined && totalOverdraft === null;
  const totalsConsistent = totalUnpaid !== null && totalOverdraft !== null && proposedTotalOwed !== null
    ? Math.abs(proposedTotalOwed - totalUnpaid - totalOverdraft) < 0.01
    : true;
  const totalOwed = totalUnpaid === null || suppliedOverdraftInvalid || !totalsConsistent ? null : proposedTotalOwed;
  const totalOwedValue = totalOwed === null ? "Unavailable" : fmt(totalOwed === 0 ? 0 : -totalOwed);
  const totalBalance   = cashTotal + investValue;
  const cashUnavailable = accountsError || !accounts || accounts.some(a => !Number.isFinite(Number(a.balance)));
  const overdraftUnavailable = accountsError || !accounts || accounts.some(a =>
    (typeof a.balance === "string" && !a.balance.trim()) ||
    (typeof a.balance !== "string" && typeof a.balance !== "number") ||
    !Number.isFinite(Number(a.balance)));
  const investmentsUnavailable = investmentsError || !investments || !Number.isFinite(investValue);
  const balanceUnavailable = cashUnavailable || investmentsUnavailable || !Number.isFinite(totalBalance);
  const cashLocked = access.blocked || Boolean(activeTransfer && ["approved", "liquidating", "transfer_out"].includes(activeTransfer.status));
  const investTotal    = investValue;

  const pendingBalance = primaryTransactions?.filter(t => t.status === 'pending')
    .reduce((s, t) => t.toAccountId === primaryAccount?.id ? s + Number(t.amount) : s - Number(t.amount), 0) || 0;

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
      <div className="flex min-w-0 flex-col gap-3">
        <DebtRestrictionStatus requiresPayment={access.requiresPayment} data={access.data}
          error={access.isError} retry={() => void access.refetch()} />

        {/* ── Transaction Detail Dialog ───────────────────────────────────── */}
        <Dialog open={!!selectedTxn} onOpenChange={o => !o && setSelectedTxn(null)}>
          <DialogContent className="sm:max-w-md border-primary/20 bg-[#0B2218] wealth-panel text-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-serif text-xl">
                <Info className="w-4 h-4 text-amber-400" />
                Transaction Detail
              </DialogTitle>
              <DialogDescription className="text-white/40 font-mono text-xs">REF: TXN-{selectedTxn?.id?.toString().padStart(6, '0')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-0 divide-y divide-white/10 py-2">
              {[
                { label: 'Description', val: transactionDescription(selectedTxn?.description,currency,selectedTxn?.transactionType) },
                { label: 'Amount', val: fmt(Number(selectedTxn?.amount)), accent: true },
                { label: 'Status', val: selectedTxn?.status, badge: true },
                { label: 'Type', val: selectedTxn?.transactionType },
                { label: 'Date', val: selectedTxn?.createdAt && transactionDate(selectedTxn.createdAt,true) },
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
              {(selectedTxn?.cashPostings as CashPosting[] | undefined)?.map(posting => (
                <div key={posting.accountId} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="label-caps text-white/40">Balance after transaction · {posting.accountName}</span>
                  <span className="font-mono font-semibold text-amber-400">{fmt(posting.balanceAfter)}</span>
                </div>
              ))}
            </div>
            {selectedTxn?.status === 'pending' && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-sm mb-2">
                <p className="text-[10px] text-amber-400 uppercase tracking-widest font-black mb-1">Compliance Review</p>
                <p className="text-xs text-white/60 leading-relaxed">This transaction is under review. Contact your advisor for an update.</p>
              </div>
            )}
            <Button onClick={() => setSelectedTxn(null)} className="w-full bg-white text-[#0B2218] hover:bg-white/90 rounded-sm font-bold">Close</Button>
          </DialogContent>
        </Dialog>

        {/* ── Portfolio Header ────────────────────────────────────────────── */}
        <div className="bg-[#0B2218] wealth-panel rounded-sm overflow-hidden">
          <div className="px-5 sm:px-8 py-7 border-b border-white/10">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              {/* Current funded balance; liabilities are shown separately below */}
              <div className="min-w-0">
                <p className="label-caps text-white/40 mb-1">{getGreeting()}, {user?.name?.split(' ')[0]} · Portfolio Overview</p>
                <p className="text-xs text-white/60 mb-1">Total balance · Funded accounts and holdings</p>
                <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                  <span className={`font-sans font-bold tabular-nums text-[clamp(1.75rem,6vw,3rem)] tracking-tight break-all ${isTransmitting ? "text-violet-300" : "text-white"}`} data-testid="text-total-balance">
                    {balanceUnavailable ? "Unavailable" : fmt(totalBalance)}
                  </span>
                </div>
                {isTransmitting && <p className="text-violet-300 text-xs mt-2">Funds in transit to {activeTransfer?.institutionName}</p>}
                {balanceUnavailable && <p role="alert" className="text-red-300 text-xs mt-2">
                  Current balances could not be loaded.
                  <button className="ml-2 underline" onClick={() => { void refetchAccounts(); void refetchInvestments(); }}>Retry</button>
                </p>}
              </div>
              {/* Quick actions */}
              <div className="grid grid-cols-3 gap-1.5 w-full md:w-auto md:flex md:gap-2 shrink-0">
                {QUICK_ACTIONS.map(({ label, icon: Icon, href }) => (
                  <button key={label} onClick={() => setLocation(href)}
                    data-funds-action={href !== "/accounts" ? "" : undefined}
                    className="min-w-0 flex flex-col items-center gap-1.5 px-1.5 md:px-4 py-2.5 rounded-sm bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all group"
                    data-testid={`button-quick-${label.toLowerCase()}`}>
                    <Icon className="w-4 h-4 text-white/60 group-hover:text-white transition-colors" />
                    <span className="text-[9px] uppercase tracking-widest text-white/40 group-hover:text-white/70 transition-colors font-semibold">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-white/10">
            {[
              { label: 'Liquid Cash',    val: cashUnavailable ? "Unavailable" : fmt(cashTotal), sub: statusUnavailable ? 'Transfer status unavailable' : access.blocked ? 'Contact your advisor' : pendingBalance !== 0 ? `${fmt(Math.abs(pendingBalance))} pending${cashLocked ? " · Transfer on hold" : ""}` : cashLocked ? 'Transfer on hold' : 'Available now', icon: Landmark },
              { label: 'Investments',    val: investmentsUnavailable ? "Unavailable" : fmt(investTotal), sub: 'Recorded investment value', icon: BarChart3 },
              { label: 'Overdraft', val: overdraftUnavailable ? "Unavailable" : fmt(overdraftTotal === 0 ? 0 : -overdraftTotal), sub: undefined, debt: true, icon: ArrowDownRight },
              { label: TOTAL_OWED_LABEL, val: feeSummary.isLoading ? "Loading…" : feeSummary.isError ? "Unavailable" : totalOwedValue, sub: undefined, debt: true, icon: Clock },
            ].map(({ label, val, sub, debt, icon: Icon }) => (
              <div key={label} className="px-4 sm:px-6 py-4 flex items-center gap-3 min-w-0">
                <Icon className="w-4 h-4 text-white/20 shrink-0" />
                <div className="min-w-0">
                  <p className="label-caps text-white/30 mb-0.5">{label}</p>
                  <p className={cn("font-mono font-semibold text-xs sm:text-sm [overflow-wrap:anywhere]", debt ? "text-red-300" : "text-white")} data-testid={label === 'Liquid Cash' ? "text-liquid-cash" : label === 'Investments' ? "text-investment-value" : label === 'Overdraft' ? "text-overdraft" : "text-unpaid-fees"}>{val}</p>
                  {sub && <p className="text-white/25 text-[10px] mt-0.5">{sub}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <DebtAccountSummary summary={feeSummary.data} accounts={accounts} variant="dashboard" loading={feeSummary.isLoading}
          error={feeSummary.isError} retry={() => void feeSummary.refetch()} currency={currency} />

        {/* ── Portfolio in Transit Banner ─────────────────────────────────── */}
        {activeTransfer && (() => {
          const stage = activeTransfer.status === "pending" ? 0
            : activeTransfer.status === "under_review" ? 1
            : (activeTransfer.status === "liquidating" || activeTransfer.status === "approved") ? 2
            : activeTransfer.status === "transfer_out" ? 3
            : 0;
          const isCash = activeTransfer.transferType === "cash";

          // Per-stage visual tokens — dark green for stages 0-1, amber for 2, violet for 3
          const onDark = stage <= 1; // white-text dark-bg states
          const bannerBg = stage === 3 ? "bg-violet-50 border-violet-300" : stage === 2 ? "bg-amber-50 border-amber-300" : "bg-[#0B2218] wealth-panel border-[#163830]";
          const iconBg = stage === 3 ? "bg-violet-200" : stage === 2 ? "bg-amber-200" : "bg-white/10";
          const iconEl = stage >= 2
            ? <Lock className={`w-4 h-4 ${stage === 3 ? "text-violet-700" : "text-amber-700"}`} />
            : <Building2 className="w-4 h-4 text-white/80" />;
          const titleColor = stage === 3 ? "text-violet-900" : stage === 2 ? "text-amber-800" : "text-white";
          const badgeStyle = stage === 3 ? "border-violet-400 text-violet-700 bg-violet-100" : stage === 2 ? "border-amber-400 text-amber-700 bg-amber-100" : "border-white/20 text-white/60 bg-white/5";
          const badgeLabel = stage === 0 ? "Pending Review" : stage === 1 ? "Under Review" : stage === 2 ? (isCash ? "Liquidating" : "Processing") : "Portfolio Transmission";
          const bodyColor = stage === 3 ? "text-violet-800/80" : stage === 2 ? "text-amber-800/80" : "text-white/60";
          const strongColor = stage === 3 ? "text-violet-900" : stage === 2 ? "text-amber-900" : "text-white/90";
          const dotActive = stage === 3 ? "bg-violet-500" : stage === 2 ? "bg-amber-500" : "bg-emerald-400";
          const dotInactive = onDark ? "bg-white/20" : stage === 3 ? "bg-violet-200" : "bg-amber-200";
          const labelActive = stage === 3 ? "text-violet-700" : stage === 2 ? "text-amber-700" : "text-emerald-400";
          const labelInactive = onDark ? "text-white/30" : stage === 3 ? "text-violet-300/60" : "text-amber-300/60";
          const lineActive = stage === 3 ? "bg-violet-300" : stage === 2 ? "bg-amber-300" : "bg-emerald-400/50";
          const lineInactive = onDark ? "bg-white/15" : stage === 3 ? "bg-violet-200/40" : "bg-amber-200/40";
          const completionBg = stage === 3 ? "bg-violet-100 border border-violet-300" : stage === 2 ? "bg-amber-100 border border-amber-300" : "bg-white/10 border border-white/15";
          const clockColor = stage === 3 ? "text-violet-600" : stage === 2 ? "text-amber-600" : "text-emerald-400";
          const completionLabel = stage === 3 ? "text-violet-700" : stage === 2 ? "text-amber-700" : "text-white/50";
          const completionValue = stage === 3 ? "text-violet-900" : stage === 2 ? "text-amber-900" : "text-white";
          const viewColor = stage === 3 ? "text-violet-800 hover:text-violet-950" : stage === 2 ? "text-amber-800 hover:text-amber-950" : "text-white/40 hover:text-white/80";

          const titleText = stage === 0 ? "Portfolio Transfer — Pending Review"
            : stage === 1 ? "Portfolio Transfer — Under Advisor Review"
            : stage === 2 ? "Preparing Your Portfolio Transfer"
            : "Portfolio Transfer in Progress";

          const bodyText = stage === 0
            ? <>Your transfer request to <strong className={strongColor}>{activeTransfer.institutionName}</strong> has been submitted. An advisor will review it shortly.</>
            : stage === 1
            ? <>Your request is being reviewed by our advisory team. Transfer to <strong className={strongColor}>{activeTransfer.institutionName}</strong> will proceed once the advisory review is complete.</>
            : stage === 2
            ? <>We are preparing your transfer to <strong className={strongColor}>{activeTransfer.institutionName}</strong>. Contact your advisor for updates.</>
            : <>Your transfer to <strong className={strongColor}>{activeTransfer.institutionName}</strong> is in progress. Contact your advisor for updates.</>;

          const steps = [
            { label: "Submitted", done: stage >= 0 },
            { label: "Under Review", done: stage >= 1 },
            { label: "Liquidating", done: stage >= 2 },
            { label: "Transfer Out", done: stage >= 3 },
            { label: "Complete", done: false },
          ];

          return (
            <div className={cn("rounded-sm border px-5 py-4 flex items-start justify-between gap-4", bannerBg)}>
              <div className="flex items-start gap-3 flex-1">
                <div className={cn("w-9 h-9 rounded-sm flex items-center justify-center shrink-0 mt-0.5", iconBg)}>
                  {iconEl}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className={cn("text-xs font-bold uppercase tracking-widest", titleColor)}>{titleText}</p>
                    <span className={cn("text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-sm border", badgeStyle)}>
                      {badgeLabel}
                    </span>
                  </div>
                  <p className={cn("text-xs leading-relaxed", bodyColor)}>{bodyText}</p>
                  {/* Progress steps */}
                  <div className="flex items-center mt-3">
                    {steps.map((step, i) => (
                      <div key={i} className="flex items-center">
                        <div className="flex flex-col items-center gap-1">
                          <div className={cn("w-2 h-2 rounded-full", step.done ? dotActive : dotInactive)} />
                          <span className={cn("text-[9px] font-semibold uppercase tracking-wide whitespace-nowrap", step.done ? labelActive : labelInactive)}>{step.label}</span>
                        </div>
                        {i < steps.length - 1 && (
                          <div className={cn("w-8 h-px mb-3.5 mx-1", step.done ? lineActive : lineInactive)} />
                        )}
                      </div>
                    ))}
                  </div>
                  {activeTransfer.estimatedCompletionDate && (
                    <div className={cn("flex items-center gap-2 mt-3 px-3 py-2 rounded-sm", completionBg)}>
                      <Clock className={cn("w-3.5 h-3.5 shrink-0", clockColor)} />
                      <div>
                        <p className={cn("text-[9px] font-bold uppercase tracking-widest", completionLabel)}>Estimated Completion</p>
                        <p className={cn("text-sm font-semibold", completionValue)}>
                          {new Date(activeTransfer.estimatedCompletionDate).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setLocation("/transfers")}
                className={cn("text-[10px] uppercase tracking-widest shrink-0 mt-1 flex items-center gap-0.5 transition-colors", viewColor)}
              >
                View <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          );
        })()}

        {/* ── Main Grid ───────────────────────────────────────────────────── */}
        <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">

          {/* Left column: Holdings + Transactions */}
          <div className="flex min-w-0 flex-col gap-3">

            {/* Holdings table */}
            <div className="min-w-0 border border-border/60 rounded-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-border/60 flex items-center justify-between bg-muted/20">
                <div>
                  <p className="font-semibold text-sm">Holdings</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Your recorded investments</p>
                </div>
                <Button variant="ghost" size="sm" className="text-xs text-primary hover:bg-primary/5 gap-1"
                  data-funds-action="" onClick={() => setLocation('/investments')}>
                  Manage <ChevronRight className="w-3 h-3" />
                </Button>
              </div>

              {/* Table header */}
              <div className="hidden sm:grid grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))] gap-2 px-3 sm:px-5 py-2 border-b border-border/40 bg-muted/10">
                {['Security', 'Shares', 'Avg Cost', 'Stored Value'].map(h => (
                  <p key={h} className="label-caps text-muted-foreground/60 text-right first:text-left">{h}</p>
                ))}
              </div>

              {investmentsLoading ? (
                <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : investmentsError ? (
                <div role="alert" className="px-4 py-6 text-center text-sm text-destructive">
                  <p>Holdings could not be loaded.</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => void refetchInvestments()}>Retry holdings</Button>
                </div>
              ) : investments && investments.length > 0 ? (
                <div className="divide-y divide-border/40">
                  {investments.map((inv: any) => {
                    const mktVal = Number(inv.shares) * Number(inv.currentPrice ?? inv.purchasePrice);
                    return (
                      <div key={inv.id} className="grid min-w-0 grid-cols-2 sm:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))] gap-x-3 gap-y-2 px-3 sm:px-5 py-3.5 hover:bg-muted/30 transition-colors items-center"
                        data-testid={`holding-row-${inv.id}`}>
                        <div className="col-span-2 sm:col-span-1 min-w-0">
                          <p className="font-bold text-sm [overflow-wrap:anywhere]">{inv.symbol}</p>
                        </div>
                        <div className="min-w-0 sm:text-right">
                          <p className="label-caps text-muted-foreground sm:hidden mb-1">Shares</p>
                          <p className="font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">{Number(inv.shares).toFixed(4)}</p>
                        </div>
                        <div className="min-w-0 sm:text-right">
                          <p className="label-caps text-muted-foreground sm:hidden mb-1">Avg Cost</p>
                          <p className="font-mono text-xs font-semibold [overflow-wrap:anywhere]">{fmt(Number(inv.purchasePrice))}</p>
                        </div>
                        <div className="min-w-0 sm:text-right">
                          <p className="label-caps text-muted-foreground sm:hidden mb-1">Stored Value</p>
                          <p className="font-mono text-xs font-semibold [overflow-wrap:anywhere]">{fmt(mktVal)}</p>
                        </div>
                      </div>
                    );
                  })}
                  {/* Totals row */}
                  <div className="grid min-w-0 grid-cols-2 sm:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))] gap-2 px-3 sm:px-5 py-3 bg-muted/20 items-center border-t border-border">
                    <p className="label-caps text-muted-foreground">Total</p>
                    <p className="font-mono text-sm font-bold text-right [overflow-wrap:anywhere] sm:col-start-4">{fmt(investValue)}</p>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center">
                  <BarChart3 className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No holdings yet</p>
                  <Button size="sm" variant="outline" className="mt-3 rounded-sm text-xs gap-1" data-funds-action="" onClick={() => setLocation('/investments')}>
                    <TrendingUp className="w-3 h-3" /> Start Investing
                  </Button>
                </div>
              )}
            </div>

            {/* Recent transactions */}
            <div className="min-w-0 border border-border/60 rounded-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-border/60 flex items-center justify-between bg-muted/20">
                <div>
                  <p className="font-semibold text-sm">Transaction history</p>
                  <p className="text-[10px] text-muted-foreground label-caps mt-0.5">Recent transactions</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-[9px] text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-widest">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
                  </span>
                </div>
              </div>
              <div className="min-w-0 divide-y divide-border/40 max-h-[320px] overflow-y-auto custom-scrollbar">
                {txnLoading ? (
                  <div className="p-4 space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-12" />)}</div>
                ) : txnError ? (
                  <p role="alert" className="p-4 text-sm text-red-700">Transaction history could not be loaded.</p>
                ) : transactions && transactions.length > 0 ? transactions.map((txn: any) => {
                  const incomingAccount = accounts?.find(a => a.id === txn.toAccountId);
                  const outgoingAccount = accounts?.find(a => a.id === txn.fromAccountId);
                  const internal = Boolean(incomingAccount && outgoingAccount);
                  const isIn = Boolean(incomingAccount && !outgoingAccount);
                  const isPending = txn.status === 'pending';
                  return (
                    <div key={txn.id} className="flex min-w-0 items-start justify-between gap-3 px-3 sm:px-5 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer group"
                      onClick={() => setSelectedTxn(txn)} data-testid={`txn-row-${txn.id}`}>
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className={cn('w-8 h-8 rounded-sm flex items-center justify-center shrink-0',
                          isPending ? 'bg-amber-100 dark:bg-amber-900/30' : isIn ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-rose-100 dark:bg-rose-900/30')}>
                          {isPending
                            ? <Clock className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                            : isIn
                              ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                              : <ArrowDownRight className="w-3.5 h-3.5 text-rose-700 dark:text-rose-400" />
                          }
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold whitespace-normal [overflow-wrap:anywhere]">{transactionDescription(txn.description,currency,txn.transactionType)}</p>
                          <p className="text-[10px] text-muted-foreground font-mono whitespace-normal [overflow-wrap:anywhere]">{transactionDate(txn.createdAt)}</p>
                          {!internal && <p className="text-[10px] text-muted-foreground whitespace-normal [overflow-wrap:anywhere]">
                            {incomingAccount || outgoingAccount ? accountLabel((incomingAccount || outgoingAccount)!) : "Account details unavailable"}
                          </p>}
                          <p className={cn('mt-0.5 text-[10px] font-semibold capitalize',
                            isPending ? 'text-amber-800 dark:text-amber-300' : 'text-muted-foreground')}>{txn.status}</p>
                        </div>
                      </div>
                      <div className="flex min-w-0 max-w-[60%] shrink-0 flex-col items-end gap-0.5">
                        <TransactionAmountBalance
                          amount={`${internal ? "↔ " : isIn ? "+" : "−"}${fmt(Number(txn.amount))}`}
                          currency={currency}
                          postings={(txn.cashPostings as CashPosting[] | undefined) || []}
                          amountClassName={cn('font-bold',
                            isPending ? 'text-amber-800 dark:text-amber-300' : internal ? 'text-muted-foreground' : isIn ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400')}
                          showAccountNames={internal}
                        />
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
              <button data-testid="view-transaction-history" className="w-full min-h-11 px-5 py-2.5 border-t border-border/50 text-sm text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-1"
                onClick={() => setLocation('/transactions')}>
                View transaction history <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Right column */}
          <div className="flex min-w-0 flex-col gap-3">

            {/* Account summary */}
            <div className="min-w-0 border border-border/60 rounded-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-border/60 bg-muted/20 flex items-center justify-between">
                <p className="font-semibold text-sm">Accounts</p>
                <button className="text-[10px] label-caps text-primary hover:underline" onClick={() => setLocation('/accounts')}>
                  View all
                </button>
              </div>
              <div className="divide-y divide-border/40">
                {accountsError ? (
                  <div role="alert" className="px-4 py-6 text-center text-sm text-destructive">
                    <p>Accounts could not be loaded.</p>
                    <Button size="sm" variant="outline" className="mt-3" onClick={() => void refetchAccounts()}>Retry accounts</Button>
                  </div>
                ) : accounts?.length ? accounts.slice(0, 5).map(acc => {
                  const cat = categoryOf(acc.accountType);
                  const overdrawn = Number(acc.balance) < 0;
                  return (
                    <button type="button" key={acc.id} className="block w-full px-5 py-3.5 text-left hover:bg-muted/30 transition-colors group"
                      onClick={() => setLocation(`/accounts/${acc.id}`)} data-testid={`dash-account-${acc.id}`}>
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className={cn('w-7 h-7 rounded-sm flex items-center justify-center shrink-0',
                          cat === 'investment' ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                          cat === 'business'   ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-sky-100 dark:bg-sky-900/30')}>
                          {cat === 'investment' ? <BarChart3 className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                          : cat === 'business'  ? <Briefcase className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                          :                       <Landmark className="w-3.5 h-3.5 text-sky-600" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold [overflow-wrap:anywhere]" data-testid={`dash-account-name-${acc.id}`}>{accountLabel(acc)}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{maskAccountNumber(acc.accountNumber)}</p>
                        </div>
                        <ChevronRight className="mt-1 w-3 h-3 shrink-0 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                      </div>
                      <div className="mt-1 pl-[38px]">
                        <p className={cn("font-mono text-xs font-bold tabular-nums", overdrawn && "text-rose-700 dark:text-rose-400")}>
                          <span className="[overflow-wrap:anywhere]" data-testid={`dash-account-balance-${acc.id}`}>{fmt(acc.balance)}</span>
                        </p>
                      </div>
                    </button>
                  );
                }) : (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">No accounts to display</div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 pb-1 border-t border-border/40 text-[10px] text-muted-foreground/40">
          <span>Global private offshore wealth management</span>
        </div>

      </div>
    </LayoutShell>
  );
}
