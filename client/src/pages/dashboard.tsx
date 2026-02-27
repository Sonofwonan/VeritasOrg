import { useAccounts, useInvestments, useAccountTransactions } from "@/hooks/use-finances";
import { useLocation } from "wouter";
import { LayoutShell } from "@/components/layout-shell";
import { StatCard } from "@/components/stat-card";
import { MetallicCard } from "@/components/metallic-card";
import { DollarSign, TrendingUp, Wallet, ArrowUpRight, PieChart as PieChartIcon, ArrowDownLeft, Clock, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useState } from "react";

// Mock data for the dashboard
const CHART_DATA = [
  { name: 'Jan', value: 4000 },
  { name: 'Feb', value: 3000 },
  { name: 'Mar', value: 2000 },
  { name: 'Apr', value: 2780 },
  { name: 'May', value: 1890 },
  { name: 'Jun', value: 2390 },
];

const ALLOCATION_DATA = [
  { name: 'Stocks', value: 45, color: 'hsl(var(--primary))' },
  { name: 'Bonds', value: 25, color: 'hsl(215, 20%, 65%)' },
  { name: 'Real Estate', value: 15, color: 'hsl(142, 70%, 45%)' },
  { name: 'Cash', value: 15, color: 'hsl(30, 80%, 55%)' },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: accounts, isLoading: accountsLoading } = useAccounts();
  const { data: investments, isLoading: investmentsLoading } = useInvestments();
  const [selectedTxn, setSelectedTxn] = useState<any>(null);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const checkingAccount = accounts?.find(a => a.accountType === "Checking Account");
  const { data: transactions, isLoading: transactionsLoading } = useAccountTransactions(checkingAccount?.id || 0);

  const availableCashBalance = checkingAccount ? Number(checkingAccount.balance) : 0;
  const totalBalance = accounts?.reduce((sum, acc) => sum + Number(acc.balance), 0) || 0;
  const [location, setLocation] = useLocation();
  
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
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              {getGreeting()}, {user?.name}
            </h1>
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
          <Card className="border-border/50 shadow-sm hover-elevate overflow-hidden">
            <CardHeader className="p-3 md:p-4 border-b border-border/50 bg-muted/5">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm md:text-base flex items-center gap-2">
                    <ArrowDownLeft className="w-4 h-4 text-primary" />
                    Transaction Ledger
                  </CardTitle>
                  <CardDescription className="text-[10px] md:text-xs">Ledger activity for Account #{checkingAccount?.id}</CardDescription>
                </div>
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-bold border-primary/20 text-primary">Live</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
                {transactionsLoading ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
                  </div>
                ) : transactions && transactions.length > 0 ? (
                  <div className="divide-y divide-border/50">
                    {transactions.map((txn: any) => (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        key={txn.id} 
                        className="flex items-center justify-between p-3 md:p-4 hover:bg-accent/5 transition-colors group cursor-pointer"
                        onClick={() => setSelectedTxn(txn)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110",
                            txn.status === 'pending' ? "bg-red-100 text-red-600 dark:bg-red-900/30" : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30"
                          )}>
                            {txn.status === 'pending' ? <Clock className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-xs md:text-sm truncate pr-2">{txn.description}</p>
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                              {format(new Date(txn.createdAt), 'MMM dd, yyyy')} • 
                              <span className={cn(
                                "capitalize font-medium",
                                txn.status === 'pending' ? "text-red-600" : "text-emerald-600"
                              )}>
                                {txn.status}
                              </span>
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end">
                          <p className={cn(
                            "font-black text-sm md:text-base",
                            txn.status === 'pending' ? "text-red-600" : "text-emerald-600"
                          )}>
                            {txn.toAccountId === (checkingAccount?.id ?? 0) ? '+' : '-'}${Number(txn.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                          {txn.status === 'pending' && (
                            <span className="text-[8px] uppercase tracking-tighter font-black text-red-600/70">Awaiting Verification</span>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <div className="w-12 h-12 rounded-full bg-muted/20 flex items-center justify-center mx-auto mb-3">
                      <Clock className="w-6 h-6 text-muted-foreground/40" />
                    </div>
                    <p className="text-xs text-muted-foreground">No transaction history available</p>
                  </div>
                )}
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full border-t border-border/50 rounded-none text-primary hover:bg-primary/5 text-[10px] font-bold uppercase tracking-widest h-10" 
                onClick={() => setLocation('/transfers')}
              >
                Full Audit Trail
              </Button>
            </CardContent>
          </Card>

          {/* Transaction Detail Dialog */}
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
                  <span className={cn("font-black text-lg", selectedTxn?.status === 'pending' ? "text-red-500" : "text-emerald-500")}>
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

          <Card className="border-border/50 shadow-sm hover-elevate">
            <CardHeader className="p-2 md:p-3">
              <CardTitle className="text-sm md:text-base">Connected Accounts</CardTitle>
              <CardDescription className="text-[10px] md:text-xs">{accounts?.length} active accounts</CardDescription>
            </CardHeader>
            <CardContent className="p-2 md:p-3 pt-0 md:pt-0">
              <div className="space-y-1.5">
                {accounts?.slice(0, 4).map((account) => (
                  <div key={account.id} className="flex items-center justify-between p-2 md:p-2 rounded-lg border border-border/50 bg-accent/5 hover:bg-accent/10 transition-all cursor-pointer group text-xs" onClick={() => setLocation(`/accounts/${account.id}`)}>
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
