import type { ClientFeeSummary } from "@shared/fees";
import { formatBalance, type BalanceCurrency } from "@shared/balance-currency";
import { accountLabel, maskAccountNumber } from "@shared/account-display";

type DebtAccount = {
  id: number;
  accountType: string;
  displayName?: string | null;
  accountNumber?: string | null;
  balance?: string | number | null;
};

type DebtAccountSummaryProps = {
  summary?: ClientFeeSummary;
  accounts?: DebtAccount[];
  variant?: "dashboard" | "accounts";
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

function verifiedAmount(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export function DebtAccountSummary({
  summary,
  accounts,
  variant = "dashboard",
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

  const getAccountOverdraft = (account: ClientFeeSummary["accounts"][number]): number | null => {
    if (account.overdraft !== undefined) return verifiedAmount(account.overdraft);
    const record = accounts?.find(item => item.id === account.accountId);
    const balance = record?.balance;
    if (balance !== undefined && balance !== null) {
      if (typeof balance === "string" && !balance.trim()) return null;
      const parsed = Number(balance);
      return Number.isFinite(parsed) ? Math.max(0, -parsed) : null;
    }
    return summary.totalOverdraft !== undefined && verifiedAmount(summary.totalOverdraft) === 0 ? 0 : null;
  };

  const accountAmounts = summary.accounts.map(account => {
    const authoritative = account.amountOwed === undefined ? null : verifiedAmount(account.amountOwed);
    const unpaid = verifiedAmount(account.unpaidTotal);
    const overdraft = getAccountOverdraft(account);
    const amount = account.amountOwed !== undefined
      ? unpaid !== null && (account.overdraft === undefined || overdraft !== null) ? authoritative : null
      : unpaid !== null && overdraft !== null ? unpaid + overdraft : null;
    return { account, amount, known: amount !== null };
  });
  const owingAccounts = accountAmounts
    .filter(item => !item.known || item.amount! > 0);

  const totalUnpaid = verifiedAmount(summary.totalUnpaid);
  const totalOverdraft = summary.totalOverdraft === undefined
    ? accountAmounts.length > 0 && accountAmounts.every(item => getAccountOverdraft(item.account) !== null)
      ? accountAmounts.reduce((sum, item) => sum + (getAccountOverdraft(item.account) ?? 0), 0)
      : accounts && accounts.length > 0 && accounts.every(record => {
        if (record.balance === undefined || record.balance === null || (typeof record.balance === "string" && !record.balance.trim())) return false;
        return Number.isFinite(Number(record.balance));
      })
        ? accounts.reduce((sum, record) => sum + Math.max(0, -Number(record.balance)), 0)
        : null
    : verifiedAmount(summary.totalOverdraft);
  const suppliedOverdraftInvalid = summary.totalOverdraft !== undefined && totalOverdraft === null;
  const proposedTotalOwed = summary.totalOwed === undefined
    ? totalUnpaid !== null && totalOverdraft !== null ? totalUnpaid + totalOverdraft : null
    : verifiedAmount(summary.totalOwed);
  const totalsConsistent = totalUnpaid !== null && totalOverdraft !== null && proposedTotalOwed !== null
    ? Math.abs(proposedTotalOwed - totalUnpaid - totalOverdraft) < 0.01
    : true;
  const totalOwed = totalUnpaid !== null && !suppliedOverdraftInvalid && totalsConsistent ? proposedTotalOwed : null;
  const hasKnownZeroTotal = totalUnpaid !== null && totalUnpaid === 0
    && totalOverdraft !== null && totalOverdraft === 0
    && totalOwed !== null && totalOwed === 0
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

  const showAccountNumbers = variant === "accounts" && owingAccounts.length > 1;

  return (
    <section data-testid="debt-account-summary" aria-label="Account balances" className="border border-border/60 rounded-sm overflow-hidden">
      <div className="border-b border-border/60 bg-muted/20 px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold">Account balances</h2>
      </div>
      <div className="divide-y divide-border/50">
        {owingAccounts.map(({ account, amount, known }) => {
          const amountLabel = hidden ? MASKED_AMOUNT : known && amount !== null ? formatBalance(amount === 0 ? 0 : -amount, currency) : "Unavailable";
          const record = accounts?.find(item => item.id === account.accountId);
          const maskedNumber = record?.accountNumber ? maskAccountNumber(record.accountNumber) : "Account number unavailable";
          return (
            <article
              key={account.accountId}
              data-testid={`debt-account-${account.accountId}`}
              className="grid min-w-0 gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(9rem,auto)] sm:items-center sm:px-5"
            >
              <div className="min-w-0">
                <h3
                  data-testid={`debt-account-name-${account.accountId}`}
                  className={variant === "accounts"
                    ? "sr-only"
                    : "break-words text-sm font-semibold leading-snug [overflow-wrap:anywhere]"}
                >
                  {safeName(account, accounts)}
                </h3>
                {showAccountNumbers ? (
                  <div className="mt-1 font-mono text-xs text-muted-foreground">{maskedNumber}</div>
                ) : null}
                {variant === "accounts" && <div className="mt-1 text-xs text-muted-foreground">Amount owed</div>}
              </div>
              <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-2 sm:flex-col sm:items-end sm:justify-center sm:gap-1">
                <div
                  data-testid={`debt-account-amount-${account.accountId}`}
                  className="min-w-0 whitespace-nowrap text-left font-mono text-[clamp(0.875rem,4vw,1rem)] font-semibold tabular-nums text-red-700 dark:text-red-300 sm:text-right"
                >
                  {amountLabel}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
