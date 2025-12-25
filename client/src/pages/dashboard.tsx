import { useAccounts, useInvestments } from "@/hooks/use-finances";
import { LayoutShell } from "@/components/layout-shell";
import { StatCard } from "@/components/stat-card";
import { DollarSign, TrendingUp, Wallet, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Skeleton } from "@/components/ui/skeleton";

// Mock data for chart - in real app, fetch historical data
const CHART_DATA = [
  { name: 'Jan', value: 4000 },
  { name: 'Feb', value: 3000 },
  { name: 'Mar', value: 2000 },
  { name: 'Apr', value: 2780 },
  { name: 'May', value: 1890 },
  { name: 'Jun', value: 2390 },
  { name: 'Jul', value: 3490 },
];

export default function DashboardPage() {
  const { data: accounts, isLoading: accountsLoading } = useAccounts();
  const { data: investments, isLoading: investmentsLoading } = useInvestments();

  const totalBalance = accounts?.reduce((sum, acc) => sum + Number(acc.balance), 0) || 0;
  const investmentCount = investments?.length || 0;
  
  // Calculate simplistic total investment value (mock logic for demo)
  const investmentValue = investments?.reduce((sum, inv) => {
    return sum + (Number(inv.shares) * Number(inv.currentPrice || inv.purchasePrice));
  }, 0) || 0;

  if (accountsLoading || investmentsLoading) {
    return (
      <LayoutShell>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <Skeleton className="h-[400px] w-full mt-6 rounded-xl" />
      </LayoutShell>
    );
  }

  return (
    <LayoutShell>
      {/* Hero background section */}
      <div className="relative -mx-4 -mt-4 mb-8 px-4 py-8 rounded-lg overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-15"
          style={{ backgroundImage: 'url(/assets/IMG_3468_1766680873153.jpeg)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/40 to-accent/20" />
        <div className="relative">
          <h2 className="text-3xl font-bold font-display text-foreground tracking-tight">Overview</h2>
          <p className="text-muted-foreground">Welcome back, here's your financial summary.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard 
          title="Total Balance" 
          value={`$${totalBalance.toFixed(2)}`} 
          icon={DollarSign}
          trend="up"
          trendValue="2.5%"
          description="vs last month"
          className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20"
        />
        <StatCard 
          title="Investments Value" 
          value={`$${investmentValue.toFixed(2)}`} 
          icon={TrendingUp}
          trend="up"
          trendValue="12.3%"
          description="Total portfolio gain"
        />
        <StatCard 
          title="Active Accounts" 
          value={accounts?.length.toString() || "0"} 
          icon={Wallet}
        />
        <StatCard 
          title="Total Portfolio" 
          value={`$${(totalBalance + investmentValue).toFixed(2)}`} 
          icon={ArrowUpRight}
          className="bg-primary text-primary-foreground"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-7 mb-8">
        {/* Chart Section */}
        <Card className="md:col-span-4 border-none shadow-lg shadow-black/5">
          <CardHeader>
            <CardTitle>Portfolio Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={CHART_DATA}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Quick Accounts List */}
        <Card className="md:col-span-3 border-none shadow-lg shadow-black/5">
          <CardHeader>
            <CardTitle>Your Accounts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {accounts?.slice(0, 4).map((account) => (
              <div key={account.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Account #{account.id}</p>
                    <p className="text-xs text-muted-foreground capitalize">{account.accountType}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm">${Number(account.balance).toFixed(2)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </LayoutShell>
  );
}
