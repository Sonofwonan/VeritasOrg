import { useAccounts, useInvestments } from "@/hooks/use-finances";
import { LayoutShell } from "@/components/layout-shell";
import { StatCard } from "@/components/stat-card";
import { DollarSign, TrendingUp, Wallet, ArrowUpRight, PieChart as PieChartIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

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

const ALLOCATION_DATA = [
  { name: 'Stocks', value: 45, color: 'hsl(var(--primary))' },
  { name: 'Bonds', value: 25, color: 'hsl(var(--accent))' },
  { name: 'Cash', value: 15, color: 'hsl(var(--muted-foreground))' },
  { name: 'Crypto', value: 10, color: '226 70% 45%' },
  { name: 'Real Estate', value: 5, color: '162 60% 35%' },
];

export default function DashboardPage() {
  const { data: accounts, isLoading: accountsLoading } = useAccounts();
  const { data: investments, isLoading: investmentsLoading } = useInvestments();

  const totalBalance = accounts?.reduce((sum, acc) => sum + Number(acc.balance), 0) || 0;
  
  // Calculate simplistic total investment value
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
      <div className="flex flex-col gap-8">
        {/* Page Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Wealth Overview</h1>
          <p className="text-muted-foreground text-lg">Your financial health at a glance.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard 
            title="Cash Balance" 
            value={`$${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
            icon={DollarSign}
            trend="up"
            trendValue="2.5%"
            description="Available funds"
            className="hover-elevate"
          />
          <StatCard 
            title="Investments" 
            value={`$${investmentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
            icon={TrendingUp}
            trend="up"
            trendValue="12.3%"
            description="Market value"
            className="hover-elevate"
          />
          <StatCard 
            title="Net Worth" 
            value={`$${(totalBalance + investmentValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
            icon={ArrowUpRight}
            className="bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover-elevate no-default-hover-elevate"
          />
          <StatCard 
            title="Portfolio Gain" 
            value="+$12,450" 
            icon={TrendingUp}
            trend="up"
            trendValue="8.4%"
            description="Total returns"
            className="hover-elevate"
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Main Chart */}
          <Card className="lg:col-span-2 border-border/50 shadow-sm hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Net Worth Growth</CardTitle>
                <CardDescription>Historical performance over the last 6 months</CardDescription>
              </div>
              <Button variant="outline" size="sm" className="hidden sm:flex">Download CSV</Button>
            </CardHeader>
            <CardContent>
              <div className="h-[350px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={CHART_DATA}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="name" 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                      dy={10}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                      tickFormatter={(value) => `$${value}`} 
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        borderRadius: '12px', 
                        border: '1px solid hsl(var(--border))', 
                        boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                        padding: '12px'
                      }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={3} 
                      fillOpacity={1} 
                      fill="url(#colorValue)" 
                      animationDuration={1500}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Asset Allocation */}
          <Card className="border-border/50 shadow-sm hover-elevate">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChartIcon className="w-5 h-5 text-primary" />
                Asset Allocation
              </CardTitle>
              <CardDescription>Current portfolio distribution</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={ALLOCATION_DATA}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {ALLOCATION_DATA.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color.includes('hsl') ? entry.color : `hsl(${entry.color})`} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                  <span className="text-2xl font-bold">100%</span>
                  <span className="text-xs text-muted-foreground">Allocated</span>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                {ALLOCATION_DATA.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color.includes('hsl') ? item.color : `hsl(${item.color})` }} />
                      <span className="text-muted-foreground">{item.name}</span>
                    </div>
                    <span className="font-semibold">{item.value}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Transactions & Accounts */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-border/50 shadow-sm hover-elevate">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Your latest financial movements</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                        <TrendingUp className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-semibold">Stock Purchase: AAPL</p>
                        <p className="text-xs text-muted-foreground">Dec {20+i}, 2025 • Investment Account</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-destructive">-$1,250.00</p>
                      <p className="text-[10px] uppercase tracking-wider font-bold text-accent">Completed</p>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="ghost" className="w-full mt-6 text-primary hover:bg-primary/5">View All Activity</Button>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm hover-elevate">
            <CardHeader>
              <CardTitle>Connected Accounts</CardTitle>
              <CardDescription>Managing {accounts?.length} active accounts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {accounts?.slice(0, 4).map((account) => (
                  <div key={account.id} className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-accent/5 hover:bg-accent/10 transition-all cursor-pointer group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                        <Wallet className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">Account #{account.id}</p>
                        <p className="text-xs text-muted-foreground capitalize">{account.accountType}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-base">${Number(account.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      <p className="text-[10px] text-muted-foreground">Current Balance</p>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="ghost" className="w-full mt-6 text-primary hover:bg-primary/5">Manage Accounts</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </LayoutShell>
  );
}
