import { useAccounts, useAccountTransactions } from "@/hooks/use-finances";
import { LayoutShell } from "@/components/layout-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { accountLabel, transactionDate, type CashPosting } from "@shared/account-display";
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

  return (
    <LayoutShell>
      <div className="mb-8">
        <Button 
          variant="ghost" 
          className="gap-2 mb-4"
          onClick={() => setLocation("/accounts")}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Accounts
        </Button>
        
        <div className="space-y-2">
          <h2 className="break-words text-3xl font-bold font-display">
            {accountLabel(account)}
          </h2>
          <Button ref={detailsTriggerRef} type="button" variant="outline" size="sm" className="mt-3"
            aria-haspopup="dialog" aria-controls="account-details-dialog" onClick={() => setDetailsOpen(true)}>
            Account details
          </Button>
        </div>
      </div>

      {/* Account Summary */}
      <div className="mb-6 max-w-3xl">
        <Card className="min-w-0 border-primary/15 bg-primary/[0.035]" data-testid="account-detail-balance">
          <CardHeader>
            <CardTitle>Balance</CardTitle>
          </CardHeader>
          <CardContent>
            {balanceError ? (
              <div role="alert" className="text-sm text-destructive">Balance details are unavailable.</div>
            ) : (
              <div className="space-y-3">
                <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-sm text-muted-foreground">Balance</p>
                  <p data-testid="text-account-cash-balance" className={cn("whitespace-nowrap font-mono text-xl font-semibold tabular-nums sm:text-2xl", accountBalance < 0 ? "text-red-700 dark:text-red-300" : "text-primary")}>
                    {money(accountBalance)}
                  </p>
                </div>
                {feeSummary.isLoading ? (
                  <div role="status" aria-label="Loading unpaid fees" className="flex items-center justify-between gap-4 border-t pt-3">
                    <p className="text-sm text-muted-foreground">Unpaid fees</p>
                    <Skeleton className="h-4 w-20" />
                  </div>
                ) : feeSummary.isError ? (
                  <div role="alert" className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm">
                    <span className="text-muted-foreground">Unpaid fee details are unavailable.</span>
                    <button type="button" className="underline underline-offset-4" onClick={() => void feeSummary.refetch()}>Retry</button>
                  </div>
                ) : unpaidFees > 0 ? (
                  <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t pt-3">
                    <p className="text-sm text-muted-foreground">Unpaid fees</p>
                    <p className="whitespace-nowrap font-mono font-semibold tabular-nums" data-testid="text-total-fee-debt">{money(unpaidFees)}</p>
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
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
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>Recent account activity</CardDescription>
          </div>
           <Button data-testid="button-export-statement" variant="outline" size="sm" className="w-full gap-2 sm:w-auto" disabled={transactionsLoading || transactionsError} onClick={() => exportStatement(account, transactions || [], currency)}>
            <Download className="w-4 h-4" />
            Export
          </Button>
        </CardHeader>
        <CardContent>
          <div className="max-h-[min(65vh,720px)] space-y-1 overflow-y-auto overscroll-contain pr-1" aria-label="Scrollable account transaction history">
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
                    className="group flex min-w-0 cursor-pointer items-start justify-between gap-3 border-b p-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary last:border-0 sm:p-4"
                    onClick={() => setSelectedTxn(transaction)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedTxn(transaction);
                      }
                    }}
                  >
                      <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
                      <div className={cn(
                        "p-2 rounded-full",
                        transaction.status === 'pending' ? 'bg-red-100 text-red-700' : (isIncoming ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')
                      )}>
                        {transaction.status === 'pending' ? (
                          <Clock className="w-5 h-5 animate-pulse" />
                        ) : isIncoming ? (
                          <TrendingUp className="w-5 h-5" />
                        ) : (
                          <TrendingDown className="w-5 h-5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="break-words font-medium transition-colors group-hover:text-primary">{transactionDescription(transaction.description,currency,transaction.transactionType)}</p>
                        <p className="text-sm text-muted-foreground">{transactionDate(transaction.createdAt)}</p>
                        <p className={cn("mt-0.5 text-xs font-semibold capitalize", transaction.status === "pending" ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground")}>
                          {transaction.status}
                        </p>
                      </div>
                    </div>
                    <TransactionAmountBalance
                      amount={`${isIncoming ? "+" : "−"}${money(transaction.amount)}`}
                      currency={currency}
                      postings={(transaction.cashPostings as CashPosting[] | undefined)?.filter(posting => posting.accountId === accountId) || []}
                      amountClassName={cn("text-lg font-bold", transaction.status === 'pending' ? 'text-red-700 dark:text-red-300' : (isIncoming ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'))}
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
