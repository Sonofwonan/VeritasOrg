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
import { useState } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { ClientFees } from "@/components/fees/client-fees";
import { transactionDescription, clientBalanceCurrency, formatBalance, type BalanceCurrency } from "@shared/balance-currency";
import { useAuth } from "@/hooks/use-auth";
import { useClientFeeSummary } from "@/hooks/use-fees";
import { FeeLiability } from "@/components/fees/fee-liability";
import { accountStatementCsv } from "@/lib/account-statement";
import { accountLabel, transactionDate } from "@shared/account-display";

function exportStatement(account: { id: number; accountType: string }, transactions: any[] = [], currency: BalanceCurrency = "CAD") {
  const csv = accountStatementCsv(account.id,transactions,currency);
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `veritas-account-${account.id}-statement.csv`;
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
  const overdraft = accountFees?.overdraft === undefined ? Math.max(0, -accountBalance) : Number(accountFees.overdraft);
  const amountOwed = accountFees?.amountOwed === undefined ? overdraft + unpaidFees : Number(accountFees.amountOwed);
  const balanceError = feeSummary.isError || !Number.isFinite(accountBalance) ||
    !Number.isFinite(unpaidFees) || unpaidFees < 0 || !Number.isFinite(overdraft) ||
    overdraft < 0 || !Number.isFinite(amountOwed) || amountOwed < 0;

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
        </div>
      </div>

      {/* Account Summary */}
      <div className="mb-8 grid min-w-0 gap-6 md:grid-cols-[1.2fr_0.8fr]">
        <Card className="min-w-0" data-testid="account-detail-balance">
          <CardHeader>
            <CardTitle>Account balance</CardTitle>
          </CardHeader>
          <CardContent>
            {feeSummary.isLoading ? (
              <FeeLiability loading currency={currency} accounts={[account]} />
            ) : balanceError ? (
              <FeeLiability error retry={() => void feeSummary.refetch()} currency={currency} accounts={[account]} />
            ) : overdraft > 0 ? (
              <FeeLiability
                summary={{
                  totalUnpaid: String(unpaidFees),
                  totalOverdraft: String(overdraft),
                  totalOwed: String(amountOwed),
                  accounts: [{
                    accountId,
                    accountName: accountLabel(account),
                    unpaidTotal: String(unpaidFees),
                    unpaidCount: accountFees?.unpaidCount || 0,
                    overdraft: String(overdraft),
                    amountOwed: String(amountOwed),
                  }],
                }}
                currency={currency}
                accounts={[account]}
                accountLinks={false}
              />
            ) : (
              <div className="space-y-3">
                <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-sm text-muted-foreground">{unpaidFees > 0 ? "Cash balance" : "Account balance"}</p>
                  <p data-testid="text-account-cash-balance" className={cn("whitespace-nowrap font-mono text-xl font-semibold tabular-nums sm:text-2xl", accountBalance < 0 ? "text-red-700 dark:text-red-300" : "text-primary")}>
                    {money(accountBalance)}
                  </p>
                </div>
                {unpaidFees > 0 && <>
                  <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t pt-3">
                    <p className="text-sm text-muted-foreground">Net account balance</p>
                    <p data-testid="text-account-net-balance" className={cn("whitespace-nowrap font-mono text-xl font-semibold tabular-nums sm:text-2xl", accountBalance - unpaidFees < 0 ? "text-red-700 dark:text-red-300" : "text-primary")}>
                      {money(accountBalance - unpaidFees)}
                    </p>
                  </div>
                  <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="text-sm text-muted-foreground">Unpaid fees</p>
                    <p className="whitespace-nowrap font-mono font-semibold tabular-nums" data-testid="text-total-fee-debt">{money(unpaidFees)}</p>
                  </div>
                </>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0" data-testid="account-detail-details">
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
          </CardHeader>
          <CardContent className="divide-y text-sm">
            <div className="flex min-w-0 flex-col gap-1 py-3 first:pt-0 sm:flex-row sm:justify-between sm:gap-4">
              <p className="shrink-0 text-muted-foreground">Account type</p>
              <p className="break-words font-medium sm:text-right">{account.accountType}</p>
            </div>
            <div className="flex min-w-0 flex-col gap-1 py-3 sm:flex-row sm:justify-between sm:gap-4">
              <p className="shrink-0 text-muted-foreground">Account holder</p>
              <p className="break-words font-medium sm:text-right">{user?.name || "—"}</p>
            </div>
            {user?.clientRef && (
              <div className="flex min-w-0 flex-col gap-1 py-3 sm:flex-row sm:justify-between sm:gap-4">
                <p className="shrink-0 text-muted-foreground">Client reference</p>
                <p className="break-all font-mono font-medium sm:text-right">{user.clientRef}</p>
              </div>
            )}
            {account.createdAt && Number.isFinite(new Date(account.createdAt).getTime()) && (
              <div className="flex min-w-0 flex-col gap-1 py-3 last:pb-0 sm:flex-row sm:justify-between sm:gap-4">
                <p className="shrink-0 text-muted-foreground">Opened</p>
                <p className="font-medium sm:text-right">{transactionDate(account.createdAt)}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
                    className="group flex min-w-0 cursor-pointer flex-col gap-3 border-b p-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary last:border-0 sm:flex-row sm:items-center sm:justify-between sm:p-4"
                    onClick={() => setSelectedTxn(transaction)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedTxn(transaction);
                      }
                    }}
                  >
                      <div className="flex min-w-0 items-center gap-3 sm:gap-4 flex-1">
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
                      </div>
                    </div>
                      <div className="flex min-w-0 items-center justify-between gap-3 sm:block sm:text-right">
                      <p className={cn(
                        "whitespace-nowrap font-mono text-lg font-bold tabular-nums",
                         transaction.status === 'pending' ? 'text-red-700 dark:text-red-300' : (isIncoming ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300')
                      )}>
                         {isIncoming ? '+' : '-'}{money(transaction.amount)}
                      </p>
                      <Badge variant={transaction.status === 'completed' ? 'default' : 'destructive'} className="text-xs mt-1 capitalize">
                        {transaction.status}
                      </Badge>
                    </div>
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
