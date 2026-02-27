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

type AccountType = 'Checking Account' | 'Savings Account' | 'Money Market Account' | 'Certificate of Deposit (CCD)' | 'High-Yield Savings' | 'Brokerage Account' | 'Traditional IRA' | 'Roth IRA' | '401(k) / 403(b)' | '529 Savings Plan' | 'Trust Account' | 'Business Checking' | 'Business Savings';

const INVESTMENT_ACCOUNT_TYPES = ['Brokerage Account', 'Traditional IRA', 'Roth IRA', '401(k) / 403(b)', '529 Savings Plan'];

export default function AccountDetailPage() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { data: accounts, isLoading: accountsLoading } = useAccounts();
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
            {account.accountType}
          </h2>
          <p className="text-muted-foreground">Account ID: {account.id}</p>
        </div>
      </div>

      {/* Account Summary */}
      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Account Balance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Current Balance</p>
              <p className="text-5xl font-bold font-display text-primary">
                ${accountBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="flex gap-4">
              <Button className="gap-2">
                <TrendingUp className="w-4 h-4" />
                Deposit
              </Button>
              <Button variant="outline" className="gap-2">
                <TrendingDown className="w-4 h-4" />
                Withdraw
              </Button>
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
              <p className="font-semibold">{account.accountType}</p>
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
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {transactions && transactions.length > 0 ? (
              transactions.map((transaction) => {
                const isIncoming = transaction.toAccountId === accountId;
                return (
                  <div 
                    key={transaction.id} 
                    className="flex items-center justify-between p-4 rounded-lg hover:bg-muted/50 transition-colors border-b last:border-0 cursor-pointer group"
                    onClick={() => setSelectedTxn(transaction)}
                  >
                    <div className="flex items-center gap-4 flex-1">
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
                        <p className="font-medium group-hover:text-primary transition-colors">{transaction.description}</p>
                        <p className="text-sm text-muted-foreground">{new Date(transaction.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        "font-bold text-lg",
                        transaction.status === 'pending' ? 'text-red-600' : (isIncoming ? 'text-green-600' : 'text-red-600')
                      )}>
                        {isIncoming ? '+' : '-'}${Number(transaction.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                  <span className="font-bold">{selectedTxn?.description}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-zinc-400 text-sm">Amount</span>
                  <span className={cn("font-black text-lg", selectedTxn?.status === 'pending' ? "text-red-500" : (selectedTxn?.toAccountId === accountId ? "text-emerald-500" : "text-red-500"))}>
                    ${Number(selectedTxn?.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                  <span className="font-medium">{selectedTxn?.createdAt && format(new Date(selectedTxn.createdAt), 'MMMM dd, yyyy HH:mm')}</span>
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
    </LayoutShell>
  );
}
