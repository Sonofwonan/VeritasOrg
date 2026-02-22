import { useAccounts, useInvestments } from "@/hooks/use-finances";
import { useLocation } from "wouter";
import { LayoutShell } from "@/components/layout-shell";
import { StatCard } from "@/components/stat-card";
import { MetallicCard } from "@/components/metallic-card";
import { DollarSign, TrendingUp, Wallet, ArrowUpRight, PieChart as PieChartIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";

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
  const { user } = useAuth();
  const { data: accounts, isLoading: accountsLoading } = useAccounts();
  const { data: investments, isLoading: investmentsLoading } = useInvestments();

  const checkingAccount = accounts?.find(a => a.accountType === "Checking Account");
  const availableCashBalance = checkingAccount ? Number(checkingAccount.balance) : 0;
  const totalBalance = accounts?.reduce((sum, acc) => sum + Number(acc.balance), 0) || 0;
  const [location, setLocation] = useLocation();
  
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

  const primaryAccount = accounts?.[0];

  return (
    <LayoutShell>
      <div className="flex flex-col gap-2 md:gap-3">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Wealth Overview</h1>
            <p className="text-muted-foreground text-xs md:text-sm">Your financial health at a glance.</p>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <StatCard 
              title="Available Cash Balance" 
              value={`$${availableCashBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
              icon={DollarSign}
              trend="up"
              trendValue="2.5%"
              description="Checking Account"
              className="hover-elevate"
            />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <StatCard 
              title="Investments" 
              value={`$${investmentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
              icon={TrendingUp}
              trend="up"
              trendValue="12.3%"
              description="Market value"
              className="hover-elevate"
            />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <StatCard 
              title="Net Worth" 
              value={`$${(totalBalance + investmentValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
              icon={ArrowUpRight}
              className="bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover-elevate no-default-hover-elevate"
            />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <StatCard 
              title="Portfolio Gain" 
              value={`$${(investmentValue * 0.084).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
              icon={TrendingUp}
              trend="up"
              trendValue="8.4%"
              description="Total returns"
              className="hover-elevate"
              data-testid="text-portfolio-gain"
            />
          </motion.div>
        </div>

        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {/* Main Chart */}
          <Card className="lg:col-span-2 border-border/50 shadow-sm hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between gap-2 p-2 md:p-3">
              <div>
                <CardTitle className="text-sm md:text-base">Net Worth Growth</CardTitle>
                <CardDescription className="text-[10px] md:text-xs">Last 6 months</CardDescription>
              </div>
              <Button variant="outline" size="sm" className="hidden sm:flex h-7 text-xs">Download CSV</Button>
            </CardHeader>
            <CardContent className="p-1 md:p-3 pt-0 md:pt-0">
              <div className="h-[150px] md:h-[200px] w-full">
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
            <CardHeader className="p-2 md:p-3">
              <CardTitle className="flex items-center gap-2 text-sm md:text-base">
                <PieChartIcon className="w-4 h-4 text-primary" />
                Asset Allocation
              </CardTitle>
              <CardDescription className="text-[10px] md:text-xs">Portfolio distribution</CardDescription>
            </CardHeader>
            <CardContent className="p-2 md:p-3 pt-0 md:pt-0">
              <div className="h-[120px] md:h-[150px] w-full relative">
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
              <div className="mt-2 space-y-1.5">
                {ALLOCATION_DATA.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color.includes('hsl') ? item.color : `hsl(${item.color})` }} />
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
        <div className="grid gap-2 md:grid-cols-2">
          <Card className="border-border/50 shadow-sm hover-elevate">
            <CardHeader className="p-2 md:p-3">
              <CardTitle className="text-sm md:text-base">Recent Activity</CardTitle>
              <CardDescription className="text-[10px] md:text-xs">Latest movements</CardDescription>
            </CardHeader>
            <CardContent className="p-2 md:p-3 pt-0 md:pt-0">
              <div className="space-y-2">
                {investments?.slice(0, 3).map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                        <TrendingUp className="w-4 h-4 md:w-5 md:h-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">Investment: {inv.symbol}</p>
                        <p className="text-[10px] md:text-xs text-muted-foreground">{inv.shares} shares @ ${inv.currentPrice || inv.purchasePrice}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm md:text-base text-primary" data-testid={`text-investment-value-${inv.id}`}>${(Number(inv.shares) * Number(inv.currentPrice || inv.purchasePrice)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      <p className="text-[9px] md:text-[10px] uppercase tracking-wider font-bold text-accent">Held</p>
                    </div>
                  </div>
                ))}
                {(!investments || investments.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-2">No recent investment activity</p>
                )}
              </div>
              <Button variant="ghost" size="sm" className="w-full mt-2 text-primary hover:bg-primary/5 text-xs h-7" onClick={() => setLocation('/investments')}>View All Investments</Button>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm hover-elevate">
            <CardHeader className="p-2 md:p-3">
              <CardTitle className="text-sm md:text-base">Connected Accounts</CardTitle>
              <CardDescription className="text-[10px] md:text-xs">{accounts?.length} active accounts</CardDescription>
            </CardHeader>
            <CardContent className="p-2 md:p-3 pt-0 md:pt-0">
              <div className="space-y-1.5">
                {accounts?.slice(0, 4).map((account) => (
                  <div key={account.id} className="flex items-center justify-between p-2 md:p-2 rounded-lg border border-border/50 bg-accent/5 hover:bg-accent/10 transition-all cursor-pointer group text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                        <Wallet className="w-3 h-3 md:w-4 md:h-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-[10px] md:text-xs">Account #{account.id}</p>
                        <p className="text-[8px] md:text-[9px] text-muted-foreground capitalize">{account.accountType}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="font-bold text-xs">${Number(account.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        <p className="text-[7px] md:text-[8px] text-muted-foreground">Balance</p>
                      </div>
                      <ArrowUpRight className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="ghost" size="sm" className="w-full mt-2 text-primary hover:bg-primary/5 text-xs h-7" onClick={() => setLocation('/transfers')}>Manage Accounts</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </LayoutShell>
  );
}
