import { useAccounts } from "@/hooks/use-finances";
import { LayoutShell } from "@/components/layout-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Download, TrendingUp, TrendingDown, Wallet, CreditCard, Briefcase } from "lucide-react";
import { useLocation } from "wouter";
import { useParams } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

type AccountType = 'checking' | 'savings' | 'money_market' | 'cd' | 'high_yield_savings' | 'brokerage' | 'traditional_ira' | 'roth_ira' | '401k' | '529_plan' | 'trust_account' | 'business_checking' | 'business_savings';

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: 'Checking Account',
  savings: 'Savings Account',
  money_market: 'Money Market Account',
  cd: 'Certificate of Deposit',
  high_yield_savings: 'High-Yield Savings',
  brokerage: 'Brokerage Account',
  traditional_ira: 'Traditional IRA',
  roth_ira: 'Roth IRA',
  '401k': '401(k) / 403(b)',
  '529_plan': '529 Savings Plan',
  trust_account: 'Trust Account',
  business_checking: 'Business Checking',
  business_savings: 'Business Savings',
};

export default function AccountDetailPage() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { data: accounts, isLoading } = useAccounts();
  
  const accountId = parseInt(params.id as string);
  const account = accounts?.find(a => a.id === accountId);

  if (isLoading) {
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
  const isInvestment = ['brokerage', 'traditional_ira', 'roth_ira', '401k', '529_plan'].includes(account.accountType);

  // Generate mock transaction history for demo
  const mockTransactions = [
    {
      id: 1,
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      type: 'transfer',
      description: 'Transfer from Checking Account',
      amount: 500,
      direction: 'in' as const,
      status: 'completed'
    },
    {
      id: 2,
      date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      type: 'buy',
      description: 'Stock Purchase - AAPL',
      amount: 250,
      direction: 'out' as const,
      status: 'completed'
    },
    {
      id: 3,
      date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      type: 'transfer',
      description: 'Dividend Payment',
      amount: 125,
      direction: 'in' as const,
      status: 'completed'
    },
    {
      id: 4,
      date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      type: 'sell',
      description: 'Stock Sale - GOOGL',
      amount: 1200,
      direction: 'in' as const,
      status: 'completed'
    },
  ];

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
            {ACCOUNT_TYPE_LABELS[account.accountType] || account.accountType}
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
              <p className="font-semibold">{ACCOUNT_TYPE_LABELS[account.accountType] || account.accountType}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Created</p>
              <p className="font-semibold">{new Date(account.createdAt!).toLocaleDateString()}</p>
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
            {mockTransactions.length > 0 ? (
              mockTransactions.map((transaction) => (
                <div 
                  key={transaction.id} 
                  className="flex items-center justify-between p-4 rounded-lg hover:bg-muted/50 transition-colors border-b last:border-0"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`p-2 rounded-full ${
                      transaction.direction === 'in' 
                        ? 'bg-green-100 text-green-600' 
                        : 'bg-red-100 text-red-600'
                    }`}>
                      {transaction.direction === 'in' ? (
                        <TrendingUp className="w-5 h-5" />
                      ) : (
                        <TrendingDown className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{transaction.description}</p>
                      <p className="text-sm text-muted-foreground">{transaction.date}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-lg ${
                      transaction.direction === 'in' 
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      {transaction.direction === 'in' ? '+' : '-'}${transaction.amount.toLocaleString()}
                    </p>
                    <Badge variant="outline" className="text-xs mt-1">
                      {transaction.status}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No transactions yet</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </LayoutShell>
  );
}
