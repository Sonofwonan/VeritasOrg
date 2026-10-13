import { useClientFeeSummary } from "@/hooks/use-fees";
import { accountLabel } from "@shared/account-display";
import { DebtAccountSummary } from "@/components/fees/debt-account-summary";
import { useState } from "react";
import {
  Plus, ChevronRight, TrendingUp,
  Landmark, Briefcase, Eye, EyeOff,
  CheckCircle2, AlertCircle, Lock, Building2
} from "lucide-react";
import { useAccounts, useInvestments, useCreateAccount, useAccountTransactions } from "@/hooks/use-finances";
import { useActiveLiquidation } from "@/hooks/use-liquidation-status";
import { LayoutShell } from "@/components/layout-shell";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { clientBalanceCurrency, formatBalance } from "@shared/balance-currency";
import { maskAccountNumber } from "@shared/account-display";

type AccountType = 'Brokerage Account' | 'Traditional IRA' | 'Roth IRA' |
  '401(k) / 403(b)' | '529 Savings Plan' | 'Trust Account';

function categoryOf(type: string): keyof typeof CATEGORY_META {
  // Presentation only: trusts still support investment operations.
  if (type === 'Trust Account') return 'business';
  return 'investment';
}

const CATEGORY_META = {
  cash:       { label: 'Cash & Deposits',        Icon: Landmark,  color: 'text-sky-800 dark:text-sky-300' },
  investment: { label: 'Brokerage & Retirement', Icon: TrendingUp, color: 'text-emerald-800 dark:text-emerald-300' },
  business:   { label: 'Business & Trust',        Icon: Briefcase, color: 'text-amber-800 dark:text-amber-300' },
};

const ACCOUNT_TYPE_OPTIONS = [
  { group: 'Investment & Retirement', items: ['Brokerage Account','Traditional IRA','Roth IRA','401(k) / 403(b)','529 Savings Plan'] },
  { group: 'Business & Trust', items: ['Trust Account'] },
];

export default function AccountsPage() {
  const { data: accounts, isLoading, isError: accountsError, refetch: refetchAccounts } = useAccounts();
  const { data: investments, isLoading: investmentsLoading, isError: investmentsError, refetch: refetchInvestments } = useInvestments();
  const primaryAccount = accounts?.find(a => a.accountType === 'Brokerage Account') || accounts?.[0];
  const { data: transactions } = useAccountTransactions(primaryAccount?.id || 0);
  const createAccount = useCreateAccount();
  const { user } = useAuth();
  const currency = clientBalanceCurrency(user);
  const money = (value: string | number) => formatBalance(value, currency);
  const feeSummary = useClientFeeSummary();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { transfers: instTransfers } = useActiveLiquidation();
  const activeTransfer = (instTransfers as any[]).find((t: any) =>
    ["pending", "under_review", "approved", "liquidating", "transfer_out"].includes(t.status)
  );
  const xferStage = activeTransfer?.status === "pending" ? 0
    : activeTransfer?.status === "under_review" ? 1
    : (activeTransfer?.status === "liquidating" || activeTransfer?.status === "approved") ? 2
    : activeTransfer?.status === "transfer_out" ? 3
    : -1;
  const isLocked = xferStage >= 2; // liquidating or transfer_out — accounts fully locked
  const isTransmitting = xferStage === 3; // funds actively leaving — show $0 balance

  const [hideBalances, setHideBalances] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ title: string; message: string; type: 'success' | 'error' } | null>(null);
  const [newAccountType, setNewAccountType] = useState<AccountType>('Brokerage Account');

  const pendingBalance = transactions
    ?.filter(t => t.status === 'pending')
    .reduce((sum, t) => {
      const amt = Number(t.amount);
      return t.toAccountId === primaryAccount?.id ? sum + amt : sum - amt;
    }, 0) || 0;

  // Account balances are cash, even in a Brokerage account. Debt is not an asset.
  const cashTotal = accounts?.reduce((sum, account) => sum + Math.max(0, Number(account.balance)), 0) ?? 0;
  const investTotal = investments?.reduce((sum, holding) =>
    sum + Number(holding.shares) * Number(holding.currentPrice ?? holding.purchasePrice), 0) ?? 0;
  const cashUnavailable = accountsError || !accounts || accounts.some(account => !Number.isFinite(Number(account.balance)));
  const investmentsUnavailable = investmentsError || !investments || investments.some(holding =>
    !Number.isFinite(Number(holding.shares)) || Number(holding.shares) < 0 ||
    !Number.isFinite(Number(holding.currentPrice ?? holding.purchasePrice)) ||
    Number(holding.currentPrice ?? holding.purchasePrice) < 0) || !Number.isFinite(investTotal);
  const totalBalance = cashTotal + investTotal;
  const balanceLoading = isLoading || investmentsLoading;
  const balanceUnavailable = cashUnavailable || investmentsUnavailable || !Number.isFinite(totalBalance);
  const retryBalances = () => { void refetchAccounts(); void refetchInvestments(); };

  const fmt = (n: number) => hideBalances ? '••••••' : money(n);

  const handleCreate = () => {
    if (!user) return;
    createAccount.mutate({ userId: user.id, accountType: newAccountType, balance: '0', isDemo: false }, {
      onSuccess: (data: any) => {
        setIsOpen(false);
        setFeedback({ title: 'Account Opened', message: `${data.accountType} has been established and is ready for use.`, type: 'success' });
      },
      onError: (err: any) => toast({ title: 'Error', description: err.message || 'Failed to open account.', variant: 'destructive' }),
    });
  };

  const grouped = (Object.keys(CATEGORY_META) as (keyof typeof CATEGORY_META)[]).map(cat => ({
    cat,
    items: (accounts || []).filter(a => categoryOf(a.accountType) === cat),
  })).filter(g => g.items.length > 0);

  return (
    <LayoutShell>

      {/* Feedback dialog */}
      <Dialog open={!!feedback} onOpenChange={o => !o && setFeedback(null)}>
        <DialogContent className="sm:max-w-sm border-primary/20 bg-zinc-950 text-white">
          <DialogHeader className="flex flex-col items-center gap-4 py-4">
            {feedback?.type === 'success'
              ? <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/40"><CheckCircle2 className="w-7 h-7 text-emerald-400" /></div>
              : <div className="w-14 h-14 rounded-full bg-rose-500/20 flex items-center justify-center border border-rose-500/40"><AlertCircle className="w-7 h-7 text-rose-400" /></div>
            }
            <DialogTitle className="text-lg font-serif text-center">{feedback?.title}</DialogTitle>
            <DialogDescription className="text-zinc-400 text-center text-sm leading-relaxed">{feedback?.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center pt-2">
            <Button onClick={() => setFeedback(null)} className="bg-primary hover:bg-primary/90 text-white rounded-sm px-8">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Open account dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-sm bg-[#0B2218] wealth-panel border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-white">Open New Account</DialogTitle>
            <DialogDescription className="text-white/40 text-xs">Select an account type to establish with Veritas.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-1.5">
              <p className="label-caps text-white/40">Account Type</p>
              <Select value={newAccountType} onValueChange={(v) => setNewAccountType(v as AccountType)}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white rounded-sm h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0B2218] wealth-panel border-white/10 text-white">
                  {ACCOUNT_TYPE_OPTIONS.map(group => (
                    <div key={group.group}>
                      <p className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-widest text-white/30 font-semibold">{group.group}</p>
                      {group.items.map(item => (
                        <SelectItem key={item} value={item} className="text-white/80 focus:bg-white/10 focus:text-white rounded-sm">{item}</SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="text-white/40 hover:text-white" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createAccount.isPending} className="bg-white text-[#0B2218] hover:bg-white/90 rounded-sm font-semibold">
              {createAccount.isPending ? 'Opening…' : 'Open Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Portfolio Summary Header ──────────────────────────────── */}
      <div data-testid="accounts-summary-panel" className="bg-[#0B2218] wealth-panel rounded-sm overflow-hidden [container-type:inline-size]">
        {/* Top bar */}
        <div className="px-4 py-5 xl:px-8 xl:pt-8 xl:pb-6 border-b border-white/10">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between xl:gap-4">
            <div className="min-w-0">
              <p className="label-caps text-white/40 mb-2">Total balance</p>
              <div className="flex min-w-0 flex-wrap items-end gap-x-4 gap-y-1">
                  <span className={`min-w-0 max-w-full whitespace-nowrap font-sans font-bold not-italic tabular-nums [font-size:clamp(1.25rem,6cqi,3rem)] tracking-tight ${isTransmitting ? "text-violet-300" : "text-white"}`} data-testid="text-total-balance">
                  {balanceLoading ? "Loading…" : balanceUnavailable ? "Unavailable" : fmt(totalBalance)}
                </span>
              </div>
              {isTransmitting && <p className="text-violet-300/60 text-xs mt-1.5 font-mono">Funds in transit to {activeTransfer?.institutionName}</p>}
               {!balanceLoading && balanceUnavailable && <p role="alert" className="text-red-300 text-xs mt-2">
                 Current balances could not be loaded.
                 <button className="ml-2 underline" onClick={retryBalances}>Retry</button>
               </p>}
            </div>
            <div className="flex w-full items-center justify-end gap-2 xl:w-auto xl:mt-1">
              <button
                onClick={() => setHideBalances(h => !h)}
                className="flex min-h-10 items-center gap-1.5 px-2 text-white/50 hover:text-white/80 transition-colors text-xs uppercase tracking-widest"
                data-testid="button-toggle-balances"
              >
                {hideBalances ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                {hideBalances ? 'Show' : 'Hide'}
              </button>
              <div className="w-px h-4 bg-white/10" />
              <Button
                size="sm"
                onClick={() => setIsOpen(true)}
                 className="min-h-10 bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded-sm text-xs gap-1.5"
                data-testid="button-open-account"
              >
                <Plus className="w-3 h-3" /> Open Account
              </Button>
            </div>
          </div>
        </div>

        {/* Category breakdown */}
        <div className="grid grid-cols-1 divide-y divide-white/10 xl:grid-cols-2 xl:divide-x xl:divide-y-0">
          {[
            { cat: 'cash', label: 'Cash balances', value: cashTotal, Icon: Landmark, sub: 'Across your accounts', loading: isLoading, unavailable: cashUnavailable },
            { cat: 'investment', label: 'Recorded investments', value: investTotal, Icon: TrendingUp, sub: 'Holdings only', loading: investmentsLoading, unavailable: investmentsUnavailable },
          ].map(({ cat, label, value, Icon, sub, loading, unavailable }) => (
            <div key={label} data-testid={`account-summary-${cat}`} className="flex items-center justify-between gap-4 px-4 py-3 xl:block xl:px-6 xl:py-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 sm:mb-2">
                  <Icon className="w-3.5 h-3.5 shrink-0 text-white/30" />
                  <span className="text-white/40 text-[10px] uppercase tracking-widest font-semibold">{label}</span>
                </div>
                <p className="hidden text-white/25 text-[10px] mt-0.5 xl:block">{sub}</p>
              </div>
              <p data-testid={`account-summary-balance-${cat}`} className="whitespace-nowrap font-sans font-bold text-sm xl:text-xl text-amber-300 tracking-tight tabular-nums">{loading ? "Loading…" : unavailable ? "Unavailable" : fmt(value)}</p>
              <p className="sr-only sm:hidden">{sub}</p>
            </div>
          ))}
        </div>

        <div className="accounts-debt-summary border-t border-white/10">
          <style>{`
            .accounts-debt-summary > section {
              border: 0 !important;
              border-radius: 0 !important;
              background: transparent !important;
              color: rgba(255, 255, 255, 0.92);
            }
            .accounts-debt-summary h2 {
              display: none !important;
            }
            .accounts-debt-summary > section > div.border-b {
              display: none !important;
            }
            .accounts-debt-summary article {
              grid-template-columns: minmax(0, 1fr) auto;
              align-items: center;
              padding: 0.75rem 1rem;
            }
            .accounts-debt-summary article + article {
              border-color: rgba(255, 255, 255, 0.1) !important;
            }
            .accounts-debt-summary article [data-testid^="debt-account-amount-"] {
              color: #fff !important;
              font-family: "DM Sans", sans-serif !important;
              font-style: normal !important;
              font-size: 1rem !important;
              font-weight: 700 !important;
              letter-spacing: -0.025em;
              font-variant-numeric: tabular-nums;
              white-space: nowrap !important;
            }
            .accounts-debt-summary .text-muted-foreground {
              color: rgba(255, 255, 255, 0.68) !important;
            }
            .accounts-debt-summary [role="alert"] {
              color: rgba(255, 255, 255, 0.88) !important;
            }
            .accounts-debt-summary [role="alert"] button {
              color: #f3d58a !important;
            }
            .accounts-debt-summary [role="status"] > div {
              background-color: rgba(255, 255, 255, 0.12) !important;
            }
          `}</style>
          <DebtAccountSummary summary={feeSummary.data} accounts={accounts} variant="accounts" loading={feeSummary.isLoading || isLoading}
            error={feeSummary.isError || accountsError} retry={() => { void feeSummary.refetch(); void refetchAccounts(); }}
            hidden={hideBalances} currency={currency} />
        </div>
      </div>

      {/* ── Transfer Lock Banner ──────────────────────────────────── */}
      {activeTransfer && (
        <div className={cn(
          "rounded-sm border px-4 py-3 flex items-start gap-3 mt-2",
          isTransmitting ? "bg-violet-950/30 border-violet-500/20"
          : isLocked     ? "bg-amber-950/30 border-amber-500/20"
          :                "bg-primary/5 border-primary/15"
        )}>
          <div className={cn(
            "w-8 h-8 rounded-sm flex items-center justify-center shrink-0 mt-0.5",
            isTransmitting ? "bg-violet-500/15" : isLocked ? "bg-amber-500/15" : "bg-primary/15"
          )}>
            {isTransmitting
              ? <Building2 className="w-4 h-4 text-violet-400" />
              : isLocked
              ? <Lock className="w-4 h-4 text-amber-400" />
              : <Building2 className="w-4 h-4 text-primary/60" />
            }
          </div>
          <div className="flex-1">
            <p className={cn(
              "text-xs font-bold uppercase tracking-widest mb-0.5",
              isTransmitting ? "text-violet-400" : isLocked ? "text-amber-400" : "text-primary"
            )}>
              {isTransmitting
                ? "Portfolio Transmission in Progress"
                : isLocked
                ? "Accounts Locked — Portfolio Liquidating"
                : xferStage === 1 ? "Transfer Under Advisor Review" : "Transfer Pending Advisor Review"
              }
            </p>
            <p className={cn("text-xs leading-relaxed", isTransmitting || isLocked ? "text-white/90" : "text-foreground/80")}>
              {isTransmitting
                ? <>Your liquidated portfolio is being transmitted to <strong className={isTransmitting || isLocked ? "text-white" : "text-foreground"}>{activeTransfer.institutionName}</strong>. Balances below reflect the pre-transfer holdings and will clear upon custodian confirmation.</>
                : isLocked
                ? <>Holdings are being liquidated for transfer. All accounts are read-only. Your portfolio is in transit to <strong className={isTransmitting || isLocked ? "text-white" : "text-foreground"}>{activeTransfer.institutionName}</strong>.</>
                : <>Your transfer request to <strong className={isTransmitting || isLocked ? "text-white" : "text-foreground"}>{activeTransfer.institutionName}</strong> is {xferStage === 1 ? "under advisor review" : "pending review"}. Accounts remain fully accessible until approved.</>
              }
            </p>
          </div>
        </div>
      )}

      {/* ── Account Groups ─────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-2 mt-2">
          {[1,2,3].map(i => (
            <div key={i} className="h-16 bg-muted/40 rounded-sm animate-pulse" />
          ))}
        </div>
      ) : cashUnavailable ? (
        <p role="alert" className="mt-4 text-sm text-red-700">
          Account balances could not be loaded. <button className="underline" onClick={() => void refetchAccounts()}>Retry</button>
        </p>
      ) : (
        <div className="space-y-6 mt-2">
          {grouped.map(({ cat, items }) => {
            const { label, Icon, color } = CATEGORY_META[cat as keyof typeof CATEGORY_META];
            return (
               <div key={cat} data-testid={`account-group-${cat}`}>
                {/* Group header */}
                <div className="flex flex-col gap-1 mb-1 pb-2 border-b border-border sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={cn('w-3.5 h-3.5', color)} />
                    <span className="label-caps text-muted-foreground">{label}</span>
                    <span className="text-[10px] text-muted-foreground/50 font-mono ml-1">({items.length})</span>
                  </div>
                </div>

                {/* Account rows */}
                <div className="divide-y divide-border/50">
                  {items.map((account) => {
                    const isPending = account.id === primaryAccount?.id && pendingBalance !== 0;
                    const unpaidFees = Number(feeSummary.data?.accounts.find(item => item.accountId === account.id)?.unpaidTotal || 0);
                    return (
                      <div
                        key={account.id}
                        role="link"
                        tabIndex={0}
                        className="grid grid-cols-1 gap-2 items-center py-4 px-1 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset transition-colors cursor-pointer group xl:grid-cols-[1fr_auto] xl:gap-4"
                        onClick={() => setLocation(`/accounts/${account.id}`)}
                        onKeyDown={event => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setLocation(`/accounts/${account.id}`);
                          }
                        }}
                        data-testid={`account-row-${account.id}`}
                      >
                        {/* Left: name + number */}
                          <div className="flex items-center gap-3 min-w-0 xl:gap-4">
                          <div className={cn(
                            'w-9 h-9 rounded-sm flex items-center justify-center shrink-0',
                            cat === 'investment' ? 'bg-emerald-500/10' :
                            cat === 'business'   ? 'bg-amber-500/10' : 'bg-sky-500/10'
                          )}>
                            <Icon className={cn('w-4 h-4', color)} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground [overflow-wrap:anywhere]">{accountLabel(account)}</p>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                              <span className="font-mono text-[10px] text-muted-foreground">{maskAccountNumber(account.accountNumber)}</span>
                              {isPending && (
                                <span className="text-[9px] text-amber-800 dark:text-amber-300 font-bold uppercase tracking-wide bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded-sm border border-amber-200 dark:border-amber-800/40">
                                  Pending: {fmt(Math.abs(pendingBalance))}
                                </span>
                              )}
                              {isTransmitting && (
                                <span className="flex items-center gap-1 text-[9px] text-violet-400 font-bold uppercase tracking-wide bg-violet-500/10 px-1.5 py-0.5 rounded-sm border border-violet-500/20">
                                  <Building2 className="w-2.5 h-2.5" /> Transmitting
                                </span>
                              )}
                              {isLocked && !isTransmitting && (
                                <span className="flex items-center gap-1 text-[9px] text-amber-800 dark:text-amber-300 font-bold uppercase tracking-wide bg-amber-500/10 px-1.5 py-0.5 rounded-sm border border-amber-500/20">
                                  <Lock className="w-2.5 h-2.5" /> Liquidating
                                </span>
                              )}
                              {!isLocked && activeTransfer && (
                                <span className="text-[9px] text-primary/60 font-bold uppercase tracking-wide bg-primary/5 px-1.5 py-0.5 rounded-sm border border-primary/15">
                                  {xferStage === 1 ? "Under Review" : "Transfer Pending"}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: balance + arrow */}
                        <div className="flex min-w-0 items-center justify-between gap-3 xl:justify-end xl:gap-4 xl:shrink-0">
                          <div className="min-w-0 text-right xl:min-w-[140px]">
                                <p className={cn("whitespace-nowrap font-mono text-[clamp(.82rem,4vw,1rem)] font-semibold tabular-nums xl:text-base", Number(account.balance) < 0 ? "text-red-700 dark:text-red-300" : isTransmitting ? "text-violet-400" : "text-foreground")} data-testid={`balance-${account.id}`}>
                                {fmt(Number(account.balance))}
                              </p>
                            {unpaidFees > 0 && <p className="mt-1 text-xs text-rose-800 dark:text-rose-300">
                              Unpaid fees <span className="font-mono tabular-nums" data-testid={`account-unpaid-fees-${account.id}`}>{fmt(unpaidFees)}</span>
                            </p>}
                          </div>

                          <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Footer note ─────────────────────────────────────────────── */}
      <div className="mt-8 pt-4 border-t border-border/50 text-[10px] text-muted-foreground/40">
        <span>Global private offshore wealth management</span>
      </div>

    </LayoutShell>
  );
}
