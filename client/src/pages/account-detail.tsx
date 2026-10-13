import { useAccounts, useAccountTransactions } from "@/hooks/use-finances";
import { LayoutShell } from "@/components/layout-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Download, TrendingUp, TrendingDown, Clock, Info, ChevronDown } from "lucide-react";
import { useLocation } from "wouter";
import { useParams } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ClientFees } from "@/components/fees/client-fees";
import { transactionDescription, clientBalanceCurrency, formatBalance, type BalanceCurrency } from "@shared/balance-currency";
import { useAuth } from "@/hooks/use-auth";
import { useClientFeeSummary } from "@/hooks/use-fees";
import { accountStatementCsv } from "@/lib/account-statement";
import { accountLabel, maskAccountNumber, transactionDate, type CashPosting } from "@shared/account-display";
import { TransactionAmountBalance } from "@/components/transaction-amount-balance";

function exportStatement(account: { id: number; accountType: string; accountNumber?: string }, transactions: any[] = [], currency: BalanceCurrency = "CAD") {
  const number = account.accountNumber || "account-number-unavailable";
  const csv = accountStatementCsv(account.id, number, transactions, currency);
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `veritas-account-${number.replace(/[^a-zA-Z0-9_-]/g, "")}-statement.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function AccountDetailPage() {
  const { user } = useAuth();
  const currency = clientBalanceCurrency(user);
  const money = (value: string | number) => formatBalance(value,currency);
  const params = useParams();
  const [, setLocation] = useLocation();
  const { data: accounts, isLoading: accountsLoading, isError: accountsError, refetch: refetchAccounts } = useAccounts();
  const feeSummary = useClientFeeSummary();
  const [selectedTxn, setSelectedTxn] = useState<any>(null);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsTriggerRef = useRef<HTMLButtonElement>(null);
  
  const accountId = parseInt(params.id as string);
  const account = accounts?.find(a => a.id === accountId);
  const { data: transactions, isLoading: transactionsLoading, isError: transactionsError, refetch: refetchTransactions } = useAccountTransactions(accountId);

  if (accountsLoading) {
    return (
      <LayoutShell>
        <div className="mb-8">
          <Skeleton className="h-12 w-32 mb-4" />
          <Skeleton className="h-6 w-64" />
        </div>
        <div className="grid gap-6">
          <Skeleton className="h-40" />
          <Skeleton className="h-96" />
        </div>
      </LayoutShell>
    );
  }

  if (accountsError) {
    return <LayoutShell><div role="alert" className="border border-red-300 bg-red-50 p-4 text-red-950">
      Account details could not be loaded.
      <Button variant="outline" className="ml-3" onClick={() => void refetchAccounts()}>Retry</Button>
    </div></LayoutShell>;
  }

  if (!account) {
    return (
      <LayoutShell>
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Account not found</p>
          <Button onClick={() => setLocation("/accounts")}>Back to Accounts</Button>
        </div>
      </LayoutShell>
    );
  }

  const accountBalance = Number(account.balance);
  const accountFees = feeSummary.data?.accounts.find(item => item.accountId === accountId);
  const unpaidFees = Number(accountFees?.unpaidTotal || 0);
  const balanceError = !Number.isFinite(accountBalance) ||
    !Number.isFinite(unpaidFees) || unpaidFees < 0;
  const displayBalance = money(accountBalance);

  return (
    <LayoutShell>
      <div className="mb-4 border-b border-border pb-4">
        <Button 
          variant="ghost" 
          className="mb-2 h-auto gap-2 px-0 py-1 text-sm text-muted-foreground hover:bg-transparent hover:text-primary"
          onClick={() => setLocation("/accounts")}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Accounts
        </Button>
        
        <div className="grid min-w-0 grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] items-start gap-2 sm:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] sm:gap-5 md:items-end md:gap-8">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Account</p>
            <h2 className="break-words font-serif text-2xl font-medium leading-tight sm:text-3xl">
              {accountLabel(account)}
            </h2>
            <p className="mt-2 font-mono text-sm tracking-wide text-muted-foreground">{maskAccountNumber(account.accountNumber)}</p>
            <Button ref={detailsTriggerRef} type="button" variant="outline" size="sm" className="mt-3 w-fit"
              aria-haspopup="dialog" aria-controls="account-details-dialog" onClick={() => setDetailsOpen(true)}>
              Account details
            </Button>
          </div>
          <div className="min-w-0 [container-type:inline-size] border-l border-primary/20 pl-2 pt-1 text-right sm:pl-4 md:pt-0" data-testid="account-detail-balance">
            {balanceError ? (
              <div role="alert" className="text-sm text-destructive">Balance details are unavailable.</div>
            ) : (
              <div className="space-y-3">
                <div className="flex min-w-0 flex-col items-end gap-1">
                  <p className="label-caps text-xs text-muted-foreground">Balance</p>
                  <p data-testid="text-account-cash-balance"
                    style={{ fontSize: `clamp(12px, ${Math.min(11.5, 170 / displayBalance.length)}cqi, 20px)` }}
                    className={cn("max-w-full whitespace-nowrap font-sans font-semibold leading-tight tracking-tight tabular-nums", accountBalance < 0 ? "text-red-700 dark:text-red-300" : "text-primary")}>
                    {displayBalance}
                  </p>
                </div>
                {feeSummary.isLoading ? (
                  <div role="status" aria-label="Loading unpaid fees" className="flex items-center justify-between gap-4 border-t border-border/70 pt-3">
                    <p className="text-sm text-muted-foreground">Unpaid fees</p>
                    <Skeleton className="h-4 w-20" />
                  </div>
                ) : feeSummary.isError ? (
                  <div role="alert" className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3 text-sm">
                    <span className="text-muted-foreground">Unpaid fee details are unavailable.</span>
                    <button type="button" className="underline underline-offset-4" onClick={() => void feeSummary.refetch()}>Retry</button>
                  </div>
                ) : unpaidFees > 0 ? (
                  <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-border/70 pt-3">
                    <p className="text-sm text-muted-foreground">Unpaid fees</p>
                    <p className="whitespace-nowrap font-mono font-semibold tabular-nums" data-testid="text-total-fee-debt">{money(unpaidFees)}</p>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent id="account-details-dialog" className="w-[calc(100%-2rem)] max-h-[min(85dvh,38rem)] overflow-y-auto sm:max-w-md"
          onCloseAutoFocus={event => {
            event.preventDefault();
            detailsTriggerRef.current?.focus();
          }}>
          <DialogHeader>
            <DialogTitle>Account details</DialogTitle>
            <DialogDescription>
              Recorded account information. The application account number identifies this account within Veritas; it is not an external payment instruction.
            </DialogDescription>
          </DialogHeader>
          <div className="divide-y text-sm">
            {[
              ["Application account number", account.accountNumber || "Account number unavailable"],
              ["Account name", accountLabel(account)],
              ["Account type", account.accountType],
              ["Account holder", user?.name || "—"],
              ...(account.createdAt && Number.isFinite(new Date(account.createdAt).getTime())
                ? [["Opened", transactionDate(account.createdAt)]] : []),
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-1 py-3 first:pt-0 sm:flex-row sm:justify-between sm:gap-4">
                <span className="shrink-0 text-muted-foreground">{label}</span>
                <span className={cn("break-words font-medium sm:text-right", label === "Application account number" && "font-mono")}>{value}</span>
              </div>
            ))}
          </div>
          <Button onClick={() => setDetailsOpen(false)} className="w-full">Close</Button>
        </DialogContent>
      </Dialog>

      {/* Transaction History */}
      <Card className="min-w-0 overflow-hidden border-0 border-y border-border bg-transparent shadow-none">
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b px-0 py-3">
          <div className="min-w-0">
            <h3 className="font-serif text-xl font-medium sm:text-2xl">Transaction history</h3>
            <CardDescription className="mt-0.5 text-xs sm:text-sm">Recorded activity for this account</CardDescription>
          </div>
           <Button data-testid="button-export-statement" aria-label="Export" title="Export statement" variant="outline" size="sm" className="h-9 w-9 shrink-0 p-0 sm:h-9 sm:w-auto sm:gap-2 sm:px-3" disabled={transactionsLoading || transactionsError} onClick={() => exportStatement(account, transactions || [], currency)}>
            <Download className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </CardHeader>
        <CardContent className="px-0 py-2">
          <div className="max-h-[min(65vh,720px)] overflow-y-auto overscroll-contain" aria-label="Scrollable account transaction history">
            {transactionsLoading ? (
              <div role="status" className="space-y-3 p-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : transactionsError ? (
              <div role="alert" className="p-3 text-sm text-red-700">
                Transaction history could not be loaded.
                <button data-testid="button-retry-transactions" className="ml-2 underline" onClick={() => void refetchTransactions()}>Retry</button>
              </div>
            ) : transactions && transactions.length > 0 ? (
              transactions.map((transaction) => {
                const isIncoming = transaction.toAccountId === accountId;
                return (
                  <div
                    key={transaction.id} 
                    data-testid={`account-txn-row-${transaction.id}`}
                    role="button"
                    tabIndex={0}
                    aria-haspopup="dialog"
                    className="group grid min-w-0 cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 border-b border-border/80 px-2 py-3 transition-colors hover:bg-primary/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary last:border-0 sm:grid-cols-[minmax(0,1fr)_minmax(9rem,auto)] sm:gap-x-5 sm:px-4 sm:py-4"
                    onClick={() => setSelectedTxn(transaction)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedTxn(transaction);
                      }
                    }}
                  >
                      <div className="flex min-w-0 items-start gap-2 sm:gap-3">
                      <div className={cn(
                        "mt-0.5 shrink-0 border p-1.5",
                        transaction.status === 'pending' ? 'border-amber-200 bg-amber-50 text-amber-800' : (isIncoming ? 'border-primary/20 bg-primary/[0.06] text-primary' : 'border-red-200 bg-red-50 text-red-700')
                      )}>
                        {transaction.status === 'pending' ? (
                          <Clock className="h-4 w-4" />
                        ) : isIncoming ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-medium leading-snug transition-colors group-hover:text-primary sm:text-base">{transactionDescription(transaction.description,currency,transaction.transactionType)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{transactionDate(transaction.createdAt)}<span className="px-1.5" aria-hidden="true">·</span><span className={cn("font-semibold capitalize", transaction.status === "pending" ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground")}>
                          {transaction.status}
                        </span></p>
                      </div>
                    </div>
                    <TransactionAmountBalance
                      amount={`${isIncoming ? "+" : "-"}${money(transaction.amount)}`}
                      currency={currency}
                      postings={(transaction.cashPostings as CashPosting[] | undefined)?.filter(posting => posting.accountId === accountId) || []}
                      amountClassName={cn("text-sm font-semibold sm:text-base", transaction.status === 'pending' ? 'text-red-700 dark:text-red-300' : (isIncoming ? 'text-primary' : 'text-red-700 dark:text-red-300'))}
                      showAccountNames={false}
                    />
                  </div>
                );
              })
            ) : (
              <div className="py-10 text-center">
                <p className="text-muted-foreground">No transactions yet</p>
              </div>
            )}
          </div>

          <Dialog open={!!selectedTxn} onOpenChange={(open) => !open && setSelectedTxn(null)}>
            <DialogContent className="max-h-[90dvh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Info className="w-5 h-5 text-primary" />
                  Transaction Details
                </DialogTitle>
                <DialogDescription>
                  Review the recorded transaction details.
                </DialogDescription>
              </DialogHeader>
              <div className="min-w-0 space-y-1 py-2">
                <div className="flex min-w-0 flex-col gap-1 border-b py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <span className="shrink-0 text-sm text-muted-foreground">Description</span>
                  <span className="break-words font-medium sm:text-right">{transactionDescription(selectedTxn?.description,currency,selectedTxn?.transactionType)}</span>
                </div>
                <div className="flex min-w-0 flex-col gap-1 border-b py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <span className="shrink-0 text-sm text-muted-foreground">Amount</span>
                  <span className={cn("whitespace-nowrap font-mono text-lg font-semibold tabular-nums sm:text-right", selectedTxn?.status === 'pending' ? "text-red-700 dark:text-red-300" : (selectedTxn?.toAccountId === accountId ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"))}>
                    {selectedTxn && `${selectedTxn.toAccountId === accountId ? "+" : "-"}${money(selectedTxn.amount)}`}
                  </span>
                </div>
                {(selectedTxn?.cashPostings as CashPosting[] | undefined)?.filter(posting => posting.accountId === accountId).map(posting => (
                  <div key={posting.accountId} className="flex min-w-0 flex-col gap-1 border-b py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <span className="shrink-0 text-sm text-muted-foreground">Balance after transaction</span>
                    <span className="font-mono text-sm font-semibold tabular-nums sm:text-right">{money(posting.balanceAfter)}</span>
                  </div>
                ))}
                <div className="flex min-w-0 flex-col gap-1 border-b py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <span className="shrink-0 text-sm text-muted-foreground">Status</span>
                  <Badge variant={selectedTxn?.status === 'completed' ? 'default' : 'destructive'} className="capitalize">
                    {selectedTxn?.status}
                  </Badge>
                </div>
                <div className="flex min-w-0 flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <span className="shrink-0 text-sm text-muted-foreground">Date</span>
                  <span className="font-medium sm:text-right">{selectedTxn?.createdAt && transactionDate(selectedTxn.createdAt,true)}</span>
                </div>
                {selectedTxn?.status === 'pending' && (
                  <div className="mt-2 border border-destructive/30 bg-destructive/5 p-3">
                    <p className="mb-1 text-xs font-bold uppercase tracking-widest text-destructive">Security Notice</p>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      This transaction is currently undergoing institutional verification and will remain PENDING until final settlement in June 2026.
                    </p>
                  </div>
                )}
              </div>
              <Button onClick={() => setSelectedTxn(null)} className="w-full">
                Close
              </Button>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
      <section className="mt-8 border-t pt-6" aria-labelledby="account-services-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 id="account-services-heading" className="font-semibold">Account services</h3>
            <p className="text-sm text-muted-foreground">Fee arrangements and available account services.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            aria-expanded={servicesOpen}
            aria-controls="account-services-content"
            onClick={() => setServicesOpen((open) => !open)}
            className="w-full justify-between sm:w-auto"
          >
            {servicesOpen ? "Hide account services" : "Account services"}
            <ChevronDown className={cn("ml-3 h-4 w-4 transition-transform", servicesOpen && "rotate-180")} />
          </Button>
        </div>
        <div id="account-services-content" hidden={!servicesOpen} className="mt-5 min-w-0">
          {servicesOpen && <ClientFees accountId={accountId} cashBalance={account.balance} />}
        </div>
      </section>
    </LayoutShell>
  );
}
