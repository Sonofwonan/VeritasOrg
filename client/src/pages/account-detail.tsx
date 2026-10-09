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
import { balanceCurrencyLabel, balanceText, clientBalanceCurrency, formatBalance, type BalanceCurrency } from "@shared/balance-currency";
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
  const { data: accounts, isLoading: accountsLoading } = useAccounts();
  const feeSummary = useClientFeeSummary();
  const [selectedTxn, setSelectedTxn] = useState<any>(null);
  
  const accountId = parseInt(params.id as string);
  const account = accounts?.find(a => a.id === accountId);
  const { data: transactions, isLoading: transactionsLoading } = useAccountTransactions(accountId);

  if (accountsLoading || transactionsLoading) {
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
  const unpaidFees = feeSummary.data?.accounts.find(item => item.accountId === accountId)?.unpaidTotal;
  const netBalance = accountBalance - Number(unpaidFees || 0);

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
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Net Account Balance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Account ledger cash less unpaid assessments · {balanceCurrencyLabel(currency)}</p>
              <p className={cn("break-words font-mono text-[clamp(1.75rem,7vw,3rem)] font-bold tabular-nums", netBalance < 0 ? "text-red-700" : "text-primary")}>
                {feeSummary.isError ? "Unavailable" : feeSummary.isLoading ? "Loading…" : money(netBalance)}
              </p>
                <p className="mt-2 text-sm">Cash ledger balance: <span className={cn("font-mono font-semibold tabular-nums", accountBalance < 0 ? "text-red-700" : "")}>{money(accountBalance)}</span>{accountBalance < 0 && <span className="ml-2 text-xs text-red-700">posted fee overdraft / negative cash</span>}</p>
              <FeeLiability summary={unpaidFees !== undefined ? {
                totalUnpaid: unpaidFees, totalOverdraft: feeSummary.data!.accounts.find(item => item.accountId === accountId)?.overdraft,
                totalOwed: feeSummary.data!.accounts.find(item => item.accountId === accountId)?.amountOwed,
                accounts: feeSummary.data!.accounts.filter(item => item.accountId === accountId),
              } : undefined} error={feeSummary.isError} retry={() => void feeSummary.refetch()} currency={currency} accounts={[account]} />
              <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted-foreground">
                This is the account ledger balance used to determine whether a fee assessment is payable. It is separate from the market value of investment holdings; holdings are not used or sold to pay service fees.
              </p>
            </div>
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
           <Button variant="outline" size="sm" className="gap-2" onClick={() => exportStatement(account, transactions || [], currency)}>
            <Download className="w-4 h-4" />
            Export
          </Button>
        </CardHeader>
        <CardContent>
          <div className="max-h-[min(65vh,720px)] space-y-1 overflow-y-auto overscroll-contain pr-1" aria-label="Scrollable account transaction history">
            {transactions && transactions.length > 0 ? (
              transactions.map((transaction) => {
                const isIncoming = transaction.toAccountId === accountId;
                return (
                  <div 
                    key={transaction.id} 
                    className="flex flex-col gap-3 border-b p-3 transition-colors hover:bg-muted/50 last:border-0 cursor-pointer group sm:flex-row sm:items-center sm:justify-between sm:p-4"
                    onClick={() => setSelectedTxn(transaction)}
                  >
                      <div className="flex min-w-0 items-center gap-3 sm:gap-4 flex-1">
                      <div className={cn(
                        "p-2 rounded-full",
                        transaction.status === 'pending' ? 'bg-red-100 text-red-600' : (isIncoming ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600')
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
                        <p className="font-medium group-hover:text-primary transition-colors">{balanceText(transaction.description,currency)}</p>
                        <p className="text-sm text-muted-foreground">{transactionDate(transaction.createdAt)}</p>
                      </div>
                    </div>
                      <div className="flex items-center justify-between gap-3 text-right sm:block">
                      <p className={cn(
                        "font-bold text-lg",
                        transaction.status === 'pending' ? 'text-red-600' : (isIncoming ? 'text-green-600' : 'text-red-600')
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
                  <span className="font-bold">{balanceText(selectedTxn?.description,currency)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-zinc-400 text-sm">Amount</span>
                  <span className={cn("font-black text-lg", selectedTxn?.status === 'pending' ? "text-red-500" : (selectedTxn?.toAccountId === accountId ? "text-emerald-500" : "text-red-500"))}>
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
