import { useAccounts, useAccountTransactions } from "@/hooks/use-finances";
import { LayoutShell } from "@/components/layout-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Download, TrendingUp, TrendingDown, Wallet, CreditCard, Briefcase, Clock, Info } from "lucide-react";
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

type AccountType = 'Brokerage Account' | 'Traditional IRA' | 'Roth IRA' | '401(k) / 403(b)' | '529 Savings Plan' | 'Trust Account';

const INVESTMENT_ACCOUNT_TYPES = ['Brokerage Account', 'Traditional IRA', 'Roth IRA', '401(k) / 403(b)', '529 Savings Plan'];

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
          <h2 className="text-3xl font-bold font-display">
            {accountLabel(account)}
          </h2>
          <p className="text-muted-foreground">Account ID: {account.id}</p>
        </div>
      </div>

      {/* Account Summary */}
      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <Card className="min-w-0 md:col-span-2" data-testid="account-detail-balance">
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

        <Card>
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-muted-foreground">Type</p>
              <p className="font-semibold">{accountLabel(account)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <Badge className="mt-1">Active</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>Recent account activity</CardDescription>
          </div>
           <Button data-testid="button-export-statement" variant="outline" size="sm" className="gap-2" disabled={transactionsLoading || transactionsError} onClick={() => exportStatement(account, transactions || [], currency)}>
            <Download className="w-4 h-4" />
            Export
          </Button>
        </CardHeader>
        <CardContent>
          <div className="max-h-[min(65vh,720px)] space-y-1 overflow-y-auto overscroll-contain pr-1" aria-label="Scrollable account transaction history">
            {transactionsLoading ? (
              <p role="status" className="p-3 text-sm text-muted-foreground">Loading transaction history…</p>
            ) : transactionsError ? (
              <p role="alert" className="p-3 text-sm text-red-700">
                Transaction history could not be loaded.
                <button data-testid="button-retry-transactions" className="ml-2 underline" onClick={() => void refetchTransactions()}>Retry</button>
              </p>
            ) : transactions && transactions.length > 0 ? (
              transactions.map((transaction) => {
                const isIncoming = transaction.toAccountId === accountId;
                return (
                  <div 
                    key={transaction.id} 
                    data-testid={`account-txn-row-${transaction.id}`}
                    className="flex flex-col gap-3 border-b p-3 transition-colors hover:bg-muted/50 last:border-0 cursor-pointer group sm:flex-row sm:items-center sm:justify-between sm:p-4"
                    onClick={() => setSelectedTxn(transaction)}
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
                      <div className="flex-1">
                        <p className="font-medium group-hover:text-primary transition-colors">{transactionDescription(transaction.description,currency,transaction.transactionType)}</p>
                        <p className="text-sm text-muted-foreground">{transactionDate(transaction.createdAt)}</p>
                      </div>
                    </div>
                      <div className="flex items-center justify-between gap-3 text-right sm:block">
                      <p className={cn(
                        "font-bold text-lg",
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
              <div className="text-center py-8">
                <p className="text-muted-foreground">No transactions yet</p>
              </div>
            )}
          </div>

          <Dialog open={!!selectedTxn} onOpenChange={(open) => !open && setSelectedTxn(null)}>
            <DialogContent className="sm:max-w-md border-primary/20 bg-zinc-950 text-white">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Info className="w-5 h-5 text-primary" />
                  Transaction Details
                </DialogTitle>
                <DialogDescription className="text-zinc-400">
                  Ref: TXN-{selectedTxn?.id}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-zinc-400 text-sm">Description</span>
                  <span className="font-bold">{transactionDescription(selectedTxn?.description,currency,selectedTxn?.transactionType)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-zinc-400 text-sm">Amount</span>
                  <span className={cn("font-black text-lg", selectedTxn?.status === 'pending' ? "text-red-300" : (selectedTxn?.toAccountId === accountId ? "text-emerald-300" : "text-red-300"))}>
                    {money(selectedTxn?.amount ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-zinc-400 text-sm">Status</span>
                  <Badge variant={selectedTxn?.status === 'completed' ? 'default' : 'destructive'} className="capitalize">
                    {selectedTxn?.status}
                  </Badge>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-zinc-400 text-sm">Date</span>
                  <span className="font-medium">{selectedTxn?.createdAt && transactionDate(selectedTxn.createdAt,true)}</span>
                </div>
                {selectedTxn?.status === 'pending' && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <p className="text-[10px] text-red-400 uppercase tracking-widest font-black mb-1">Security Notice</p>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      This transaction is currently undergoing institutional verification and will remain PENDING until final settlement in June 2026.
                    </p>
                  </div>
                )}
              </div>
              <Button onClick={() => setSelectedTxn(null)} className="w-full bg-primary hover:bg-primary/90 text-white font-bold rounded-xl h-11">
                Close
              </Button>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
      <ClientFees accountId={accountId} cashBalance={account.balance} />
    </LayoutShell>
  );
}
