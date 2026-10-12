import { useEffect, useMemo, useState } from "react";
import { useAccounts, usePortfolioTransactions } from "@/hooks/use-finances";
import { useAuth } from "@/hooks/use-auth";
import { LayoutShell } from "@/components/layout-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Clock, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { clientBalanceCurrency, formatBalance, transactionDescription } from "@shared/balance-currency";
import { accountLabel, transactionDate, type CashPosting } from "@shared/account-display";
import { TransactionAmountBalance } from "@/components/transaction-amount-balance";

const PAGE_SIZE = 20;
type Transaction = {
  id: number;
  fromAccountId: number | null;
  toAccountId: number | null;
  amount: string | number;
  description: string | null;
  transactionType?: string;
  status: string;
  createdAt: string | Date | null;
  cashPostings?: CashPosting[];
};

function dateSortValue(value: string | Date | null) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

export default function TransactionsPage() {
  const { user } = useAuth();
  const currency = clientBalanceCurrency(user);
  const { data: accounts, isLoading: accountsLoading, isError: accountsError, refetch: refetchAccounts } = useAccounts();
  const { data: transactions, isLoading: transactionsLoading, isError: transactionsError, refetch: refetchTransactions } = usePortfolioTransactions();
  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [page, setPage] = useState(1);

  const ownedAccounts = useMemo(() => accounts ?? [], [accounts]);
  const accountById = useMemo(() => new Map(ownedAccounts.map(account => [account.id, account])), [ownedAccounts]);

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return [...(transactions ?? []) as Transaction[]]
      .filter(transaction => {
        const from = transaction.fromAccountId == null ? undefined : accountById.get(transaction.fromAccountId);
        const to = transaction.toAccountId == null ? undefined : accountById.get(transaction.toAccountId);
        const accountMatches = accountFilter === "all" ||
          transaction.fromAccountId === Number(accountFilter) ||
          transaction.toAccountId === Number(accountFilter);
        const searchable = [
          transactionDescription(transaction.description, currency, transaction.transactionType),
          from ? accountLabel(from) : "",
          to ? accountLabel(to) : "",
        ].join(" ").toLocaleLowerCase();
        return accountMatches && (!query || searchable.includes(query));
      })
      .sort((a, b) => dateSortValue(b.createdAt) - dateSortValue(a.createdAt) || b.id - a.id);
  }, [transactions, accountById, accountFilter, search, currency]);

  useEffect(() => setPage(1), [search, accountFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleTransactions = filteredTransactions.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const retry = () => {
    if (accountsError) void refetchAccounts();
    if (transactionsError) void refetchTransactions();
  };

  return (
    <LayoutShell>
      <section className="space-y-5" data-testid="transactions-page" aria-labelledby="transactions-title">
        <header className="border-b border-border/60 pb-5">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Your accounts</p>
          <h1 id="transactions-title" className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Transaction history
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            All recorded activity across your accounts.
          </p>
        </header>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(13rem,0.42fr)]">
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              data-testid="transactions-search"
              aria-label="Search descriptions and account names"
              placeholder="Search descriptions or accounts"
              value={search}
              onChange={event => setSearch(event.target.value)}
              className="h-11 rounded-sm border-border/70 bg-background pl-10"
            />
          </div>
          <label className="flex items-center gap-3 rounded-sm border border-border/70 bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
            <span className="shrink-0 text-xs font-medium text-muted-foreground">Account</span>
            <select
              data-testid="transactions-account-filter"
              aria-label="Filter by account"
              value={accountFilter}
              onChange={event => setAccountFilter(event.target.value)}
              disabled={accountsLoading || accountsError}
              className="h-10 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="all">All accounts</option>
              {ownedAccounts.map(account => (
                <option key={account.id} value={String(account.id)}>{accountLabel(account)}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="overflow-hidden rounded-sm border border-border/70 bg-card">
          <div className="hidden grid-cols-[minmax(13rem,1.7fr)_minmax(10rem,1fr)_minmax(8rem,0.8fr)_minmax(8rem,0.75fr)] gap-4 border-b border-border/60 bg-muted/25 px-5 py-3 xl:grid">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Description</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Account</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Date</span>
            <span className="text-right text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Amount</span>
          </div>

          {accountsLoading || transactionsLoading ? (
            <div className="space-y-0 divide-y divide-border/50" data-testid="transactions-loading" role="status" aria-label="Loading transaction history">
              {Array.from({ length: 5 }, (_, index) => (
                <div key={index} className="flex items-center gap-4 px-4 py-5 sm:px-5">
                  <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/5" />
                    <Skeleton className="h-3 w-3/5" />
                  </div>
                  <Skeleton className="h-5 w-24" />
                </div>
              ))}
            </div>
          ) : accountsError || transactionsError ? (
            <div className="px-5 py-12 text-center" role="alert" data-testid="transactions-error">
              <p className="font-medium text-foreground">
                {transactionsError && accountsError
                  ? "Your transaction history and account details aren’t available right now."
                  : transactionsError
                    ? "Your transaction history isn’t available right now."
                    : "Your account details couldn’t be loaded."}
              </p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                {accountsError && !transactionsError
                  ? "Account names and filters depend on this information. Please retry, or contact your advisor if the problem continues."
                  : "Please retry. If the problem continues, contact your advisor."}
              </p>
              <Button variant="outline" className="mt-4 gap-2 rounded-sm" onClick={retry} data-testid="transactions-retry">
                <RotateCcw className="h-4 w-4" /> Retry
              </Button>
            </div>
          ) : (transactions ?? []).length === 0 ? (
            <div className="px-5 py-14 text-center" data-testid="transactions-empty">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
                <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
              </div>
              <p className="font-medium text-foreground">No transactions yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Your account activity will appear here.</p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="px-5 py-14 text-center" data-testid="transactions-no-results">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
                <Search className="h-4 w-4" aria-hidden="true" />
              </div>
              <p className="font-medium text-foreground">No matching transactions</p>
              <p className="mt-1 text-sm text-muted-foreground">Try another search or account.</p>
              {(search || accountFilter !== "all") && (
                <Button variant="ghost" className="mt-2 rounded-sm text-primary" onClick={() => { setSearch(""); setAccountFilter("all"); }}>
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="divide-y divide-border/50" role="list" aria-label="Transactions">
                {visibleTransactions.map(transaction => {
                  const fromAccount = transaction.fromAccountId == null ? undefined : accountById.get(transaction.fromAccountId);
                  const toAccount = transaction.toAccountId == null ? undefined : accountById.get(transaction.toAccountId);
                  const isInternal = Boolean(fromAccount && toAccount);
                  const isIncoming = Boolean(toAccount && !fromAccount);
                  const direction = accountFilter !== "all"
                    ? transaction.toAccountId === Number(accountFilter) ? "incoming" : "outgoing"
                    : isInternal ? "internal" : isIncoming ? "incoming" : fromAccount ? "outgoing" : "unknown";
                  const amountPrefix = direction === "internal" ? "↔ " : direction === "incoming" ? "+" : direction === "outgoing" ? "−" : "";
                  const accountText = isInternal
                    ? `${accountLabel(fromAccount!)} to ${accountLabel(toAccount!)}`
                    : fromAccount || toAccount
                      ? accountLabel((fromAccount || toAccount)!)
                      : "Account details unavailable";
                  const description = transactionDescription(transaction.description, currency, transaction.transactionType);
                  const formattedDate = transaction.createdAt ? transactionDate(transaction.createdAt) : "Date unavailable";
                  const isPending = transaction.status === "pending";
                  const Icon = isPending ? Clock : direction === "internal" ? ArrowLeftRight : direction === "incoming" ? ArrowDownLeft : ArrowUpRight;
                  return (
                    <article
                      key={transaction.id}
                      role="listitem"
                      data-testid={`transaction-row-${transaction.id}`}
                      className="grid gap-3 px-4 py-4 transition-colors hover:bg-muted/20 xl:grid-cols-[minmax(13rem,1.7fr)_minmax(10rem,1fr)_minmax(8rem,0.8fr)_minmax(8rem,0.75fr)] xl:items-center xl:gap-4 sm:px-5"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span className={cn(
                          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                          isPending ? "bg-amber-100 text-amber-800" :
                            direction === "incoming" ? "bg-emerald-100 text-emerald-800" :
                              direction === "outgoing" ? "bg-rose-100 text-rose-800" : "bg-muted text-muted-foreground"
                        )}>
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="break-words text-sm font-semibold text-foreground">{description || "Transaction"}</p>
                          <p className="mt-1 text-xs text-muted-foreground xl:hidden">{accountText}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{formattedDate}</p>
                          <p className={cn("mt-0.5 text-xs font-semibold capitalize", isPending ? "text-amber-800" : "text-muted-foreground")}>{transaction.status}</p>
                        </div>
                      </div>
                      <p className="hidden min-w-0 break-words text-sm text-muted-foreground xl:block">{accountText}</p>
                      <p className="hidden text-sm text-muted-foreground xl:block">{formattedDate}</p>
                      <div className="flex min-w-0 max-w-full items-start justify-end border-t border-border/40 pt-2 xl:border-0 xl:pt-0">
                        <div className="min-w-0 max-w-full">
                          <TransactionAmountBalance
                            amount={`${amountPrefix}${formatBalance(transaction.amount, currency)}`}
                            currency={currency}
                            postings={(transaction.cashPostings || []).filter(posting =>
                              accountFilter === "all" || posting.accountId === Number(accountFilter)
                            )}
                            amountClassName={cn(
                              isPending ? "text-amber-800" :
                                direction === "incoming" ? "text-emerald-800" :
                                  direction === "outgoing" ? "text-rose-800" : "text-foreground"
                            )}
                            showAccountNames={isInternal && accountFilter === "all"}
                          />
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
              <footer className="flex flex-col gap-3 border-t border-border/60 bg-muted/15 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <p className="text-xs text-muted-foreground" aria-live="polite" data-testid="transactions-pagination-summary">
                  Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredTransactions.length)} of {filteredTransactions.length}
                </p>
                <nav className="flex items-center justify-between gap-2 sm:justify-end" aria-label="Transaction pages" data-testid="transactions-pagination">
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-9 rounded-sm"
                    disabled={currentPage <= 1}
                    onClick={() => setPage(value => Math.max(1, value - 1))}
                    data-testid="transactions-previous-page"
                  >
                    Previous
                  </Button>
                  <span className="min-w-20 text-center text-xs tabular-nums text-muted-foreground">
                    Page {currentPage} of {pageCount}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-9 rounded-sm"
                    disabled={currentPage >= pageCount}
                    onClick={() => setPage(value => Math.min(pageCount, value + 1))}
                    data-testid="transactions-next-page"
                  >
                    Next
                  </Button>
                </nav>
              </footer>
            </>
          )}
        </div>
      </section>
    </LayoutShell>
  );
}
