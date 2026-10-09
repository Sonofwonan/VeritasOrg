import { Link } from "wouter";
import { type ClientFeeSummary } from "@shared/fees";
import { formatBalance, type BalanceCurrency } from "@shared/balance-currency";
import { accountLabel } from "@shared/account-display";

export function FeeLiability({ summary, error, retry, hidden = false, loading = false, separateFromBalance = false, currency = "CAD", accounts, paymentRequired = false }: {
  summary?: ClientFeeSummary; error?: boolean; retry?: () => void; hidden?: boolean;
  loading?: boolean; separateFromBalance?: boolean;
  currency?: BalanceCurrency;
  accounts?: { id: number; accountType: string; displayName?: string | null }[];
  paymentRequired?: boolean;
}) {
  const money = (amount: string | number) => formatBalance(amount, currency);
  const nameFor = (account: ClientFeeSummary["accounts"][number]) => {
    const record = accounts?.find(item => item.id === account.accountId);
    const name = (record ? accountLabel(record) : account.accountName)?.trim();
    // Old API responses can contain generated number-only labels.
    return name && !/^Account\s*#\s*\d+$/i.test(name)
      ? name : record?.accountType || "Account details unavailable";
  };
  if (loading) return (
    <div role="status" className="border border-border/60 p-4 text-sm text-muted-foreground">
      Loading overdraft and fee details…
    </div>
  );
  if (error) return (
    <div role="alert" className="border border-red-300 bg-red-50 p-4 text-sm text-red-900">
      {separateFromBalance
        ? "Overdraft and fee details could not be loaded. These liabilities remain separate from your total balance."
        : "Service fees could not be loaded. Net balances are unavailable."}
      <button onClick={retry} className="ml-2 underline">Retry</button>
    </div>
  );
  if (!summary || (Number(summary.totalUnpaid) <= 0 && Number(summary.totalOverdraft || 0) <= 0)) return null;
  const unpaid = Number(summary.totalUnpaid || 0);
  const overdraft = Number(summary.totalOverdraft || 0);
  return (
    <section aria-label="Outstanding service fees" className="border border-red-300 bg-red-50 p-4 sm:p-5 text-red-950">
      {paymentRequired && <div className="mb-3 border-b border-red-200 pb-3">
        <p className="font-semibold" data-testid="text-payment-required">Payment is required before access to funds can be granted.</p>
        <p className="mt-1 text-sm">A separate payment must be recorded in the Brokerage Account and the debt cleared before funds are available for transfer or investment.</p>
      </div>}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="label-caps text-red-800">Fee debt · Amount owed</p>
          <p className="mt-1 break-all font-mono text-xl sm:text-2xl font-semibold" data-testid="text-total-fee-debt">
            {hidden ? "••••••" : money(summary.totalOwed || String(unpaid + overdraft))}
          </p>
        </div>
        <Link href="/accounts" className="text-sm underline underline-offset-4">Review accounts</Link>
      </div>
      <p className="mt-2 text-xs leading-relaxed">
        {separateFromBalance
          ? "Overdrafts and unpaid fees are shown separately, not subtracted from your total balance. Overdrawn account balances remain negative. No interest is added."
          : "Posted overdraft is already reflected in the negative cash ledger; unpaid assessments remain separate from cash. No interest is added."}
      </p>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <span data-testid="text-posted-overdraft-ledger">{hidden ? "••••••" : money(-overdraft)} posted negative cash ledger</span>
        <span>{hidden ? "••••••" : money(summary.totalUnpaid)} unpaid assessments</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {summary.accounts.filter(account => Number(account.unpaidTotal) > 0 || Number(account.overdraft || 0) > 0).map(account => (
          <Link key={account.accountId} href={`/accounts/${account.accountId}`} className="underline underline-offset-4">
            {nameFor(account)}: {Number(account.overdraft || 0) > 0 ? "overdraft " : ""}{hidden ? "••••••" : money(Number(account.overdraft || 0) > 0 ? account.overdraft! : account.unpaidTotal)}
            {Number(account.overdraft || 0) <= 0 ? " owed" : Number(account.unpaidTotal) > 0 ? ` · ${hidden ? "••••••" : money(account.unpaidTotal)} unpaid fees` : ""}
            {Number(account.overdraft || 0) > 0 ? ` · ${hidden ? "••••••" : money(-Number(account.overdraft))} negative cash ledger` : ""}
            {Number(account.unpaidCount) > 0 ? ` · ${account.unpaidCount} unpaid fees` : ""}
          </Link>
        ))}
      </div>
    </section>
  );
}

export function AccountFeeBalance({ cash, unpaid, overdraft, hidden = false, dark = false, currency = "CAD" }: {
  cash: string; unpaid?: string; overdraft?: string; hidden?: boolean; dark?: boolean;
  currency?: BalanceCurrency;
}) {
  const cashDebt = Number(overdraft || 0) > 0 ? Number(overdraft) : Math.max(0, -Number(cash));
  const unpaidAmount = Number(unpaid || 0);
  if (unpaid === undefined && cashDebt <= 0) return null;
  if (unpaidAmount <= 0 && cashDebt <= 0) return null;
  const net = Number(cash) - Number(unpaid || 0);
  const fmt = (value: number | string) => hidden ? "••••••" : formatBalance(value, currency);
  return (
    <div className={`mt-2 border-t pt-2 ${dark ? "border-white/10 text-red-300" : "border-red-200 text-red-800"}`}>
      {cashDebt > 0 && <p className="break-all font-mono font-semibold" data-testid="text-fee-overdraft">Cash ledger overdraft {fmt(-cashDebt)}</p>}
      {unpaidAmount > 0 && <>
        <p className="mt-1 text-[10px] uppercase tracking-wide">Net account balance after unpaid fees</p>
        <p className="break-all font-mono font-semibold" data-testid="text-net-account-balance">{fmt(net)}</p>
        <p className="mt-1 text-xs">{fmt(unpaidAmount)} unpaid service fees</p>
      </>}
    </div>
  );
}
