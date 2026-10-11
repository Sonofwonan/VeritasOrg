import { Link } from "wouter";
import type { ReactNode } from "react";
import { type ClientFeeSummary } from "@shared/fees";
import { formatBalance, type BalanceCurrency } from "@shared/balance-currency";
import { accountLabel } from "@shared/account-display";

export function FeeLiability({ summary, error, retry, hidden = false, loading = false, currency = "CAD", accounts, accountLinks = true }: {
  summary?: ClientFeeSummary; error?: boolean; retry?: () => void; hidden?: boolean;
  loading?: boolean; separateFromBalance?: boolean;
  currency?: BalanceCurrency;
  accounts?: { id: number; accountType: string; displayName?: string | null }[];
  paymentRequired?: boolean;
  accountLinks?: boolean;
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
      Checking account balances and fees…
    </div>
  );
  if (error) return (
    <div role="alert" className="border border-red-300 bg-red-50 p-4 text-sm text-red-900">
      Account fee details could not be loaded. Amounts owed are unavailable.
      <button type="button" onClick={retry} className="ml-2 underline underline-offset-2">Retry</button>
    </div>
  );
  if (!summary) return null;
  const unpaid = Number(summary.totalUnpaid || 0);
  const overdraft = Number(summary.totalOverdraft || 0);
  const invalidAmount = (value: string | number) => !Number.isFinite(Number(value)) || Number(value) < 0;
  if ([summary.totalUnpaid, summary.totalOverdraft ?? 0, summary.totalOwed ?? unpaid + overdraft].some(invalidAmount) ||
    summary.accounts.some(account => [account.unpaidTotal, account.overdraft ?? 0, account.amountOwed ?? 0].some(invalidAmount))) {
    return <FeeLiability error retry={retry} />;
  }
  if (unpaid <= 0 && overdraft <= 0 && Number(summary.totalOwed ?? 0) <= 0 && summary.accounts.every(account =>
    Number(account.unpaidTotal) <= 0 && Number(account.overdraft ?? 0) <= 0)) return null;
  const owingAccounts = summary.accounts.filter(account =>
    Number(account.unpaidTotal) > 0 || Number(account.overdraft || 0) > 0
  );
  if (!owingAccounts.length) return <FeeLiability error retry={retry} />;
  const totalOwed = Number(summary.totalOwed || 0) || unpaid + overdraft;
  const single = owingAccounts.length === 1 ? owingAccounts[0] : undefined;
  const singleOverdraft = Number(single?.overdraft || 0);
  const singleUnpaid = Number(single?.unpaidTotal || 0);
  const simpleSingle = !!single && (singleOverdraft <= 0 || singleUnpaid <= 0);
  const amount = (value: string | number) => hidden ? "••••••" : money(value);
  const AccountReference = ({ account, children }: { account: ClientFeeSummary["accounts"][number]; children: ReactNode }) => (
    accountLinks
      ? <Link href={`/accounts/${account.accountId}`} className="min-w-0 [overflow-wrap:anywhere] underline underline-offset-4">{children}</Link>
      : <span className="min-w-0 [overflow-wrap:anywhere]">{children}</span>
  );

  if (single && simpleSingle) {
    const isOverdraft = singleOverdraft > 0;
    const value = isOverdraft ? singleOverdraft : singleUnpaid;
    const label = isOverdraft ? "Overdraft" : "Unpaid fees";
    return (
      <section aria-label="Outstanding service fees" className="border border-red-300 bg-red-50 p-4 text-red-950 sm:p-5">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <AccountReference account={single}>
            <span className="font-semibold">{nameFor(single)}</span>
            <span className="mx-1.5 text-red-800">·</span>
            <span>{label}</span>
          </AccountReference>
          <div className="flex flex-wrap items-baseline gap-x-1">
            <span className="whitespace-nowrap font-mono text-lg font-semibold tabular-nums" data-testid="text-total-fee-debt">{amount(value)}</span>
            <span className="text-sm">owed</span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Outstanding service fees" className="border border-red-300 bg-red-50 p-4 text-red-950 sm:p-5">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="label-caps text-red-800">Total owed</p>
          <p className="mt-1 whitespace-nowrap font-mono text-xl font-semibold tabular-nums sm:text-2xl" data-testid="text-total-fee-debt">
            {amount(totalOwed)}
          </p>
        </div>
        {accountLinks && <Link href="/accounts" className="text-sm underline underline-offset-4">Review accounts</Link>}
      </div>
      <div className="mt-3 divide-y divide-red-200/80">
        {owingAccounts.map(account => (
          <div key={account.accountId} className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2 first:pt-0 last:pb-0">
            <AccountReference account={account}>
              <span className="font-medium">{nameFor(account)}</span>
            </AccountReference>
            <div className="flex min-w-0 flex-wrap justify-end gap-x-4 gap-y-1 text-sm tabular-nums">
              {Number(account.overdraft || 0) > 0 && (
                <span className="whitespace-nowrap" data-testid={`text-account-overdraft-${account.accountId}`}>
                  Overdraft {amount(account.overdraft!)}
                </span>
              )}
              {Number(account.unpaidTotal) > 0 && (
                <span className="whitespace-nowrap" data-testid={`text-account-unpaid-fees-${account.accountId}`}>
                  Unpaid fees {amount(account.unpaidTotal)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AccountFeeBalance({ cash, unpaid, overdraft, hidden = false, dark = false, currency = "CAD", showOverdraft = true }: {
  cash: string; unpaid?: string; overdraft?: string; hidden?: boolean; dark?: boolean;
  currency?: BalanceCurrency;
  showOverdraft?: boolean;
}) {
  const cashDebt = Number(overdraft || 0) > 0 ? Number(overdraft) : Math.max(0, -Number(cash));
  const unpaidAmount = Number(unpaid || 0);
  if (unpaidAmount <= 0 && (!showOverdraft || cashDebt <= 0)) return null;
  const net = Number(cash) - Number(unpaid || 0);
  const fmt = (value: number | string) => hidden ? "••••••" : formatBalance(value, currency);
  return (
    <div className={`mt-2 border-t pt-2 ${dark ? "border-white/10 text-red-300" : "border-red-200 text-red-800 dark:text-red-300"}`}>
      {cashDebt > 0 && showOverdraft && <p className="break-words font-mono font-semibold" data-testid="text-fee-overdraft">Overdraft <span className="whitespace-nowrap">{fmt(cashDebt)}</span></p>}
      {unpaidAmount > 0 && <>
        <p className="mt-1 text-[10px] uppercase tracking-wide">Net account balance</p>
        <p className="whitespace-nowrap font-mono font-semibold" data-testid="text-net-account-balance">{fmt(net)}</p>
        <p className="mt-1 text-xs">Unpaid fees <span className="whitespace-nowrap">{fmt(unpaidAmount)}</span></p>
      </>}
    </div>
  );
}
