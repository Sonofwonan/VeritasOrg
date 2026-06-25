import { useState } from "react";
import {
  Plus, ArrowRight, ChevronRight, TrendingUp, TrendingDown,
  ShieldCheck, Landmark, Briefcase, PiggyBank, Eye, EyeOff,
  CheckCircle2, AlertCircle, MoreHorizontal
} from "lucide-react";
import { useAccounts, useCreateAccount, useAccountTransactions } from "@/hooks/use-finances";
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

type AccountType = 'Checking Account' | 'Savings Account' | 'Money Market Account' |
  'Certificate of Deposit (CCD)' | 'High-Yield Savings' | 'Brokerage Account' |
  'Traditional IRA' | 'Roth IRA' | '401(k) / 403(b)' | '529 Savings Plan' |
  'Trust Account' | 'Business Checking' | 'Business Savings';

const INVESTMENT_TYPES = ['Brokerage Account', 'Traditional IRA', 'Roth IRA', '401(k) / 403(b)', '529 Savings Plan'];
const BUSINESS_TYPES = ['Trust Account', 'Business Checking', 'Business Savings'];

const YTD_BY_TYPE: Record<string, { pct: string; gain: string; positive: boolean }> = {
  'Checking Account':          { pct: '0.00',  gain: '—',          positive: true },
  'Savings Account':           { pct: '+2.10', gain: '+$12,481',   positive: true },
  'Money Market Account':      { pct: '+4.85', gain: '+$38,220',   positive: true },
  'Certificate of Deposit (CCD)': { pct: '+5.25', gain: '+$26,400', positive: true },
  'High-Yield Savings':        { pct: '+4.60', gain: '+$8,740',    positive: true },
  'Brokerage Account':         { pct: '+11.4', gain: '+$184,320',  positive: true },
  'Traditional IRA':           { pct: '+9.80', gain: '+$62,100',   positive: true },
  'Roth IRA':                  { pct: '+12.3', gain: '+$44,880',   positive: true },
  '401(k) / 403(b)':          { pct: '+8.60', gain: '+$91,200',   positive: true },
  '529 Savings Plan':          { pct: '+7.20', gain: '+$18,360',   positive: true },
  'Trust Account':             { pct: '+6.40', gain: '+$128,000',  positive: true },
  'Business Checking':         { pct: '0.00',  gain: '—',          positive: true },
  'Business Savings':          { pct: '+3.10', gain: '+$24,800',   positive: true },
};

function accountNumber(id: number) {
  const n = ((id * 48271 + 13) % 900000 + 100000).toString();
  return `••••${n.slice(-4)}`;
}

function categoryOf(type: string) {
  if (INVESTMENT_TYPES.includes(type)) return 'investment';
  if (BUSINESS_TYPES.includes(type)) return 'business';
  return 'cash';
}

const CATEGORY_META = {
  cash:       { label: 'Cash & Deposits',        Icon: Landmark,  color: 'text-sky-400' },
  investment: { label: 'Investment & Retirement', Icon: TrendingUp, color: 'text-emerald-400' },
  business:   { label: 'Business & Trust',        Icon: Briefcase, color: 'text-amber-400' },
};

const ACCOUNT_TYPE_OPTIONS = [
  { group: 'Cash & Deposits', items: ['Checking Account','Savings Account','Money Market Account','Certificate of Deposit (CCD)','High-Yield Savings'] },
  { group: 'Investment & Retirement', items: ['Brokerage Account','Traditional IRA','Roth IRA','401(k) / 403(b)','529 Savings Plan'] },
  { group: 'Business & Trust', items: ['Trust Account','Business Checking','Business Savings'] },
];

export default function AccountsPage() {
  const { data: accounts, isLoading } = useAccounts();
  const checkingAccount = accounts?.find(a => a.accountType === 'Checking Account');
  const { data: transactions } = useAccountTransactions(checkingAccount?.id || 0);
  const createAccount = useCreateAccount();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [hideBalances, setHideBalances] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ title: string; message: string; type: 'success' | 'error' } | null>(null);
  const [newAccountType, setNewAccountType] = useState<AccountType>('Checking Account');

  const pendingBalance = transactions
    ?.filter(t => t.status === 'pending')
    .reduce((sum, t) => {
      const amt = Number(t.amount);
      return t.toAccountId === checkingAccount?.id ? sum + amt : sum - amt;
    }, 0) || 0;

  const totalBalance = accounts?.reduce((s, a) => s + Number(a.balance), 0) || 0;
  const cashTotal = accounts?.filter(a => categoryOf(a.accountType) === 'cash').reduce((s, a) => s + Number(a.balance), 0) || 0;
  const investTotal = accounts?.filter(a => categoryOf(a.accountType) === 'investment').reduce((s, a) => s + Number(a.balance), 0) || 0;
  const bizTotal = accounts?.filter(a => categoryOf(a.accountType) === 'business').reduce((s, a) => s + Number(a.balance), 0) || 0;

  const fmt = (n: number) => hideBalances ? '••••••' : `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2 })}`;
  const fmtShort = (n: number) => {
    if (hideBalances) return '••••';
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toFixed(2)}`;
  };

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

  const grouped = ['cash', 'investment', 'business'].map(cat => ({
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
        <DialogContent className="sm:max-w-sm bg-[#0B2218] border-white/10 text-white">
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
                <SelectContent className="bg-[#0B2218] border-white/10 text-white">
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
      <div className="bg-[#0B2218] rounded-sm overflow-hidden">
        {/* Top bar */}
        <div className="px-8 pt-8 pb-6 border-b border-white/10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="label-caps text-white/40 mb-2">Total Portfolio Value</p>
              <div className="flex items-end gap-4">
                <span className="font-serif text-5xl text-white tracking-tight" data-testid="text-total-balance">
                  {fmt(totalBalance)}
                </span>
                <span className="text-emerald-400 text-sm font-mono mb-1.5 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  +8.4% YTD
                </span>
              </div>
              <p className="text-white/30 text-xs mt-1.5 font-mono">CAD · As of {new Date().toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={() => setHideBalances(h => !h)}
                className="flex items-center gap-1.5 text-white/30 hover:text-white/60 transition-colors text-xs uppercase tracking-widest"
                data-testid="button-toggle-balances"
              >
                {hideBalances ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                {hideBalances ? 'Show' : 'Hide'}
              </button>
              <div className="w-px h-4 bg-white/10" />
              <Button
                size="sm"
                onClick={() => setIsOpen(true)}
                className="bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded-sm text-xs gap-1.5"
                data-testid="button-open-account"
              >
                <Plus className="w-3 h-3" /> Open Account
              </Button>
            </div>
          </div>
        </div>

        {/* Category breakdown */}
        <div className="grid grid-cols-3 divide-x divide-white/10">
          {[
            { label: 'Cash & Deposits', value: cashTotal, Icon: Landmark, sub: 'Available liquidity' },
            { label: 'Investments', value: investTotal, Icon: TrendingUp, sub: '+11.4% YTD avg.' },
            { label: 'Business & Trust', value: bizTotal, Icon: ShieldCheck, sub: 'Fiduciary accounts' },
          ].map(({ label, value, Icon, sub }) => (
            <div key={label} className="px-6 py-5">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-3.5 h-3.5 text-white/30" />
                <span className="text-white/40 text-[10px] uppercase tracking-widest font-semibold">{label}</span>
              </div>
              <p className="font-mono text-xl text-amber-400 tracking-tight">{fmtShort(value)}</p>
              <p className="text-white/25 text-[10px] mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Account Groups ─────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-2 mt-2">
          {[1,2,3].map(i => (
            <div key={i} className="h-16 bg-muted/40 rounded-sm animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-6 mt-2">
          {grouped.map(({ cat, items }) => {
            const { label, Icon, color } = CATEGORY_META[cat as keyof typeof CATEGORY_META];
            const catTotal = items.reduce((s, a) => s + Number(a.balance), 0);
            return (
              <div key={cat}>
                {/* Group header */}
                <div className="flex items-center justify-between mb-1 pb-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Icon className={cn('w-3.5 h-3.5', color)} />
                    <span className="label-caps text-muted-foreground">{label}</span>
                    <span className="text-[10px] text-muted-foreground/50 font-mono ml-1">({items.length})</span>
                  </div>
                  <span className="font-mono text-sm text-foreground/70">{fmt(catTotal)}</span>
                </div>

                {/* Account rows */}
                <div className="divide-y divide-border/50">
                  {items.map((account) => {
                    const ytd = YTD_BY_TYPE[account.accountType] || { pct: '—', gain: '—', positive: true };
                    const isPending = account.accountType === 'Checking Account' && pendingBalance !== 0;
                    return (
                      <div
                        key={account.id}
                        className="grid grid-cols-[1fr_auto] gap-4 items-center py-4 px-1 hover:bg-muted/30 transition-colors cursor-pointer group"
                        onClick={() => setLocation(`/accounts/${account.id}`)}
                        data-testid={`account-row-${account.id}`}
                      >
                        {/* Left: name + number */}
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={cn(
                            'w-9 h-9 rounded-sm flex items-center justify-center shrink-0',
                            cat === 'investment' ? 'bg-emerald-500/10' :
                            cat === 'business'   ? 'bg-amber-500/10' : 'bg-sky-500/10'
                          )}>
                            <Icon className={cn('w-4 h-4', color)} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{account.accountType}</p>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="font-mono text-[10px] text-muted-foreground">{accountNumber(account.id)}</span>
                              {isPending && (
                                <span className="text-[9px] text-amber-600 font-bold uppercase tracking-wide bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded-sm border border-amber-200 dark:border-amber-800/40">
                                  Pending: {fmt(Math.abs(pendingBalance))}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: balance + ytd + arrow */}
                        <div className="flex items-center gap-8 shrink-0">
                          {/* YTD */}
                          <div className="hidden sm:block text-right">
                            <p className="label-caps text-muted-foreground/50 mb-0.5">YTD Return</p>
                            <div className={cn(
                              'flex items-center justify-end gap-1 text-xs font-mono font-semibold',
                              ytd.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                            )}>
                              {ytd.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {hideBalances ? '••••' : ytd.pct}{ytd.pct !== '0.00' && ytd.pct !== '—' ? '%' : ''}
                            </div>
                          </div>

                          {/* Balance */}
                          <div className="text-right min-w-[140px]">
                            <p className="label-caps text-muted-foreground/50 mb-0.5">Balance</p>
                            <p className="font-mono text-base font-semibold text-foreground tabular-nums" data-testid={`balance-${account.id}`}>
                              {fmt(Number(account.balance))}
                            </p>
                          </div>

                          <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
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
      <div className="mt-8 pt-4 border-t border-border/50 flex items-center justify-between text-[10px] text-muted-foreground/40">
        <span className="flex items-center gap-1.5"><ShieldCheck className="w-3 h-3" /> CDIC insured · Accounts protected up to eligible limits</span>
        <span>All figures in CAD</span>
      </div>

    </LayoutShell>
  );
}
