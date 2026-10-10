import { Link } from "wouter";
import type { ClientFeeSummary } from "@shared/fees";
import { formatBalance, type BalanceCurrency } from "@shared/balance-currency";
import { accountLabel } from "@shared/account-display";

type DebtAccount = { id: number; accountType: string; displayName?: string | null };

type DebtAccountSummaryProps = {
  summary?: ClientFeeSummary;
  accounts?: DebtAccount[];
  loading?: boolean;
  error?: boolean;
  retry?: () => void;
  hidden?: boolean;
  currency?: BalanceCurrency;
};

const MASKED_AMOUNT = "••••••";

function safeName(
  feeAccount: ClientFeeSummary["accounts"][number],
  accounts?: DebtAccount[],
) {
  const record = accounts?.find(account => account.id === feeAccount.accountId);
  const accountName = (record ? accountLabel(record) : feeAccount.accountName)?.trim();
  if (accountName && !/^Account\s*#\s*\d+$/i.test(accountName)) return accountName;
  if (record?.accountType?.trim()) return record.accountType.trim();
  return "Account details unavailable";
}

export function DebtAccountSummary({
  summary,
  accounts,
  loading = false,
  error = false,
  retry,
  hidden = false,
  currency = "CAD",
}: DebtAccountSummaryProps) {
  if (loading) {
    return (
      <section data-testid="debt-account-summary" aria-label="Account balances" className="border border-border/60 p-4 sm:p-5">
        <div role="status" className="space-y-3">
          <span className="sr-only">Loading account balances…</span>
          <div className="h-4 w-36 animate-pulse rounded-sm bg-muted" />
          <div className="h-16 w-full animate-pulse rounded-sm bg-muted/70" />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section data-testid="debt-account-summary" aria-label="Account balances" className="border border-border/60 p-4 sm:p-5">
        <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Account balance details are unavailable.</span>
          <button type="button" onClick={retry} disabled={!retry} className="font-medium text-foreground underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-50">
            Retry
          </button>
        </div>
      </section>
    );
  }

  if (!summary) return null;

  const accountAmounts = summary.accounts.map(account => {
    const unpaid = Number(account.unpaidTotal);
    const overdraft = account.overdraft === undefined ? 0 : Number(account.overdraft);
    return { account, amount: unpaid + overdraft, known: Number.isFinite(unpaid) && unpaid >= 0 &&
      Number.isFinite(overdraft) && overdraft >= 0 };
  });
  const owingAccounts = accountAmounts
    .filter(item => !item.known || item.amount > 0);

  const totalUnpaid = Number(summary.totalUnpaid);
  const totalOverdraft = Number(summary.totalOverdraft ?? 0);
  const totalOwed = summary.totalOwed === undefined
    ? totalUnpaid + totalOverdraft
    : Number(summary.totalOwed);
  const hasKnownZeroTotal = Number.isFinite(totalUnpaid) && totalUnpaid <= 0
    && Number.isFinite(totalOverdraft) && totalOverdraft <= 0
    && Number.isFinite(totalOwed) && totalOwed <= 0
    && accountAmounts.every(item => item.known);

  if (owingAccounts.length === 0) {
    if (hasKnownZeroTotal) return null;
    return (
      <section data-testid="debt-account-summary" aria-label="Account balances" className="border border-border/60 p-4 sm:p-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">Account balances</h2>
          <div className="text-sm text-muted-foreground">Account details unavailable</div>
        </div>
      </section>
    );
  }

  return (
    <section data-testid="debt-account-summary" aria-label="Account balances" className="border border-border/60 rounded-sm overflow-hidden">
      <div className="border-b border-border/60 bg-muted/20 px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold">Account balances</h2>
      </div>
      <div className="divide-y divide-border/50">
        {owingAccounts.map(({ account, amount, known }) => {
          const amountLabel = hidden ? MASKED_AMOUNT : known ? formatBalance(amount, currency) : "Unavailable";
          return (
            <article
              key={account.accountId}
              data-testid={`debt-account-${account.accountId}`}
              className="grid min-w-0 gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(9rem,auto)] sm:items-center sm:px-5"
            >
              <div className="min-w-0">
                <h3
                  data-testid={`debt-account-name-${account.accountId}`}
                  className="break-words text-sm font-semibold leading-snug [overflow-wrap:anywhere]"
                >
                  {safeName(account, accounts)}
                </h3>
                <div className="mt-1 text-xs text-muted-foreground">Amount owed</div>
              </div>
              <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-2 sm:flex-col sm:items-end sm:justify-center sm:gap-1">
                <div
                  data-testid={`debt-account-amount-${account.accountId}`}
                  className="min-w-0 whitespace-nowrap text-left font-mono text-[clamp(0.875rem,4vw,1rem)] font-semibold tabular-nums sm:text-right"
                >
                  {amountLabel}
                </div>
                <Link
                  href={`/accounts/${account.accountId}`}
                  data-testid={`debt-account-details-${account.accountId}`}
                  className="shrink-0 text-xs font-medium text-primary underline underline-offset-4"
                >
                  Account details
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
