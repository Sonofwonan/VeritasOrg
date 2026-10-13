import { useInvestments, useAccounts, useBuyInvestment, useSellInvestment } from "@/hooks/use-finances";
import { MARKET_TRADING_ENABLED } from "@shared/market";
import { accountLabel } from "@shared/account-display";
import { clientBalanceCurrency, formatBalance } from "@shared/balance-currency";
import { LayoutShell } from "@/components/layout-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useFundsAccess } from "@/hooks/use-funds-access";
import { FundsAccessNotice } from "@/components/fees/funds-access-notice";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, BookOpen, Zap, DollarSign, Settings, Zap as ZapIcon, Plus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const STOCKS = ["AAPL", "GOOGL", "TSLA", "AMZN", "MSFT"];
const ETFS = ["SPY", "QQQ", "IVV", "VOO", "VTI"];
const ROBO_PORTFOLIOS = [
  { id: "conservative", name: "Conservative", allocation: "80% Bonds, 20% Stocks", risk: "Low" },
  { id: "balanced", name: "Balanced", allocation: "60% Stocks, 40% Bonds", risk: "Medium" },
  { id: "growth", name: "Growth", allocation: "80% Stocks, 20% Bonds", risk: "High" },
  { id: "aggressive", name: "Aggressive Growth", allocation: "95% Stocks, 5% Cash", risk: "Very High" },
];

const RESEARCH_ARTICLES = [
  { title: "Market Volatility: What You Should Know", category: "Market Analysis", date: "Dec 24, 2025" },
  { title: "Diversification Strategy Guide", category: "Strategy", date: "Dec 23, 2025" },
  { title: "Tax-Loss Harvesting Explained", category: "Tax Planning", date: "Dec 21, 2025" },
  { title: "Advanced Order Types Guide", category: "Trading Tools", date: "Dec 24, 2025" },
  { title: "Risk Management Strategies", category: "Risk", date: "Dec 23, 2025" },
  { title: "Technical Analysis Mastery", category: "Technical Analysis", date: "Dec 22, 2025" },
];

export default function InvestmentsPage() {
  const access = useFundsAccess();
  const { data: investments, isLoading: loadingInv } = useInvestments();
  const { data: accounts } = useAccounts();
  const buyMutation = useBuyInvestment();
  const sellMutation = useSellInvestment();
  const { toast } = useToast();
  const { user } = useAuth();
  // Stock Trading State
  const [selectedSymbol, setSelectedSymbol] = useState("AAPL");
  const [amount, setAmount] = useState("");
  const [shares, setShares] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<string>("");

  // ETF/Fractional Trading State
  const [selectedETF, setSelectedETF] = useState("SPY");
  const [etfAmount, setEtfAmount] = useState("");
  const [etfAccount, setEtfAccount] = useState<string>("");

  // Robo-Advisor State
  const [selectedRobo, setSelectedRobo] = useState("balanced");
  const [roboAccount, setRoboAccount] = useState<string>("");

  // Options Trading State
  const [optionType, setOptionType] = useState<"call" | "put">("call");
  const [strikePrice, setStrikePrice] = useState("");
  const [expiration, setExpiration] = useState("");
  const [optionAccount, setOptionAccount] = useState<string>("");

  // Advanced Orders State
  const [orderType, setOrderType] = useState("limit");
  const [limitPrice, setLimitPrice] = useState("");
  const [stopPrice, setStopPrice] = useState("");
  const [trailingPercent, setTrailingPercent] = useState("");
  const [orderAccount, setOrderAccount] = useState<string>("");

  // Never enable trading from cached quotes or stored holding prices.
  const pricingBlocked = !MARKET_TRADING_ENABLED;
  const rejectUnpricedOrder = () => {
    toast({ title: "Trading paused", description: "Trading is currently paused. Please contact your advisor.", variant: "destructive" });
  };

  // Trading eligibility is independent of Accounts-page presentation groups:
  // trusts display under Business & Trust but can also hold and trade investments.
  const investmentAccounts = accounts?.filter(a =>
    ['Brokerage Account', 'Traditional IRA', 'Roth IRA', '401(k) / 403(b)', '529 Savings Plan', 'Trust Account'].includes(a.accountType)
  ) || [];

  const handleBuy = () => {
    if (access.blocked) return;
    if (pricingBlocked) return rejectUnpricedOrder();
    if (!selectedAccount) {
      toast({ title: "Select an account", variant: "destructive" });
      return;
    }
    buyMutation.mutate({
      accountId: parseInt(selectedAccount),
      symbol: selectedSymbol,
      amount: amount
    }, {
      onSuccess: () => {
        toast({ title: "Purchase Successful", description: `Bought $${amount} of ${selectedSymbol}` });
        setAmount("");
      },
      onError: (err) => {
        toast({ title: "Failed", description: err.message, variant: "destructive" });
      }
    });
  };

  const handleSell = () => {
    if (access.blocked) return;
    if (pricingBlocked) return rejectUnpricedOrder();
    if (!selectedAccount) {
      toast({ title: "Select an account", variant: "destructive" });
      return;
    }
    sellMutation.mutate({
      accountId: parseInt(selectedAccount),
      symbol: selectedSymbol,
      shares: shares
    }, {
      onSuccess: () => {
        toast({ title: "Sale Successful", description: `Sold ${shares} shares of ${selectedSymbol}` });
        setShares("");
      },
      onError: (err) => {
        toast({ title: "Failed", description: err.message, variant: "destructive" });
      }
    });
  };

  const handleFractionalBuy = () => {
    if (access.blocked) return;
    rejectUnpricedOrder();
  };

  const handleRoboSetup = () => {
    if (!roboAccount) {
      toast({ title: "Select an account", variant: "destructive" });
      return;
    }
    const portfolio = ROBO_PORTFOLIOS.find(p => p.id === selectedRobo);
    toast({ 
      title: "Robo-Advisor Activated", 
      description: `Your ${portfolio?.name} portfolio is now actively managed. Rebalancing happens quarterly.` 
    });
  };

  const handlePlaceOption = () => {
    if (!optionAccount) {
      toast({ title: "Select an account", variant: "destructive" });
      return;
    }
    if (!strikePrice || !expiration) {
      toast({ title: "Fill in all required fields", variant: "destructive" });
      return;
    }
    toast({
      title: "Options Order Placed",
      description: `${optionType.toUpperCase()} contract on ${selectedSymbol} at $${strikePrice} strike, expires ${expiration}. Order submitted to market.`
    });
    setStrikePrice("");
    setExpiration("");
  };

  const handlePlaceOrder = () => {
    if (!orderAccount) {
      toast({ title: "Select an account", variant: "destructive" });
      return;
    }
    
    let description = "";
    if (orderType === "limit") {
      if (!limitPrice) {
        toast({ title: "Enter limit price", variant: "destructive" });
        return;
      }
      description = `Limit order on ${selectedSymbol} at $${limitPrice}`;
    } else if (orderType === "stop" || orderType === "stop-limit") {
      if (!stopPrice) {
        toast({ title: "Enter stop price", variant: "destructive" });
        return;
      }
      description = `${orderType === 'stop' ? 'Stop-Loss' : 'Stop-Limit'} order on ${selectedSymbol} at $${stopPrice}`;
    } else if (orderType === "trailing") {
      if (!trailingPercent) {
        toast({ title: "Enter trailing percentage", variant: "destructive" });
        return;
      }
      description = `Trailing stop order on ${selectedSymbol} at ${trailingPercent}%`;
    } else {
      description = `Market order on ${selectedSymbol}`;
    }
    
    toast({
      title: "Advanced Order Placed",
      description: `${description}. Order is now active and monitoring the market.`
    });
    setLimitPrice("");
    setStopPrice("");
    setTrailingPercent("");
  };

  return (
    <LayoutShell>
      <FundsAccessNotice />
      {/* Hero background section */}
      <div className="relative -mx-4 -mt-4 mb-8 px-4 py-8 rounded-lg overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-15"
          style={{ backgroundImage: 'url(/assets/IMG_3476_1766680873153.jpeg)' }}
        />
        <div className="investment-hero-scrim absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/30 to-accent/20" />
        <div className="relative">
          <h2 className="text-3xl font-bold font-display text-white">Investments</h2>
          <p className="text-white/90">Review your recorded holdings and cash positions.</p>
        </div>
      </div>

      <div role="alert" data-testid="market-trading-paused" className="mb-6 border border-border bg-muted/30 p-4 text-sm">
        Trading is currently paused. Please contact your advisor.
      </div>

      <Tabs defaultValue="stocks" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="stocks" aria-label="Stocks" className="gap-2 text-xs sm:text-sm">
            <TrendingUp className="w-4 h-4" />
            <span className="hidden sm:inline">Stocks</span>
          </TabsTrigger>
          <TabsTrigger value="etfs" aria-label="ETFs" className="gap-2 text-xs sm:text-sm">
            <DollarSign className="w-4 h-4" />
            <span className="hidden sm:inline">ETFs</span>
          </TabsTrigger>
          <TabsTrigger value="cash" aria-label="Cash" className="gap-2 text-xs sm:text-sm">
            <DollarSign className="w-4 h-4" />
            <span className="hidden sm:inline">Cash</span>
          </TabsTrigger>
        </TabsList>

        {/* Stock Trading */}
        <TabsContent value="stocks" className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Trading Panel */}
            <div className="min-w-0 lg:col-span-1">
              <Card className="border-none shadow-xl shadow-primary/5 overflow-hidden">
                <div className="bg-primary/5 p-6 border-b border-primary/10">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-2xl font-bold">{selectedSymbol}</h3>
                      <p className="text-sm text-muted-foreground">Stock</p>
                    </div>
                  </div>
                  
                  <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
                    <SelectTrigger className="bg-background h-10">
                      <SelectValue placeholder="Select Stock" />
                    </SelectTrigger>
                    <SelectContent>
                      {STOCKS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <CardContent className="p-6">
                  <div className="mb-4">
                    <Label className="text-xs mb-2 block">Source Account</Label>
                    <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select Account" />
                      </SelectTrigger>
                      <SelectContent>
                        {investmentAccounts.map(a => (
                          <SelectItem key={a.id} value={a.id.toString()}>
                            {accountLabel(a)} ({formatBalance(a.balance,clientBalanceCurrency(user))})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Tabs defaultValue="buy" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                      <TabsTrigger value="buy">Buy</TabsTrigger>
                      <TabsTrigger value="sell">Sell</TabsTrigger>
                    </TabsList>

                    <TabsContent value="buy" className="space-y-4">
                      <div className="space-y-2">
                        <Label>Amount ($)</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                          <Input 
                            type="number" 
                            placeholder="0.00" 
                            className="pl-7"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                          />
                        </div>
                      </div>
                      <Button 
                        data-funds-action=""
                        className={
                          "w-full bg-emerald-700 hover:bg-emerald-800"
                        }
                        onClick={handleBuy}
                        disabled={(pricingBlocked && !access.blocked) || buyMutation.isPending}
                      >
                        {buyMutation.isPending ? "Processing..." : "Buy Stock"}
                      </Button>
                    </TabsContent>

                    <TabsContent value="sell" className="space-y-4">
                      <div className="space-y-2">
                        <Label>Shares</Label>
                        <Input 
                          type="number" 
                          placeholder="0" 
                          value={shares}
                          onChange={e => setShares(e.target.value)}
                        />
                      </div>
                      <Button 
                        data-funds-action=""
                        className={
                          "w-full bg-rose-700 hover:bg-rose-800"
                        }
                        onClick={handleSell}
                        disabled={(pricingBlocked && !access.blocked) || sellMutation.isPending}
                      >
                        {sellMutation.isPending ? "Processing..." : "Sell Shares"}
                      </Button>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            {/* Portfolio Table */}
            <div className="min-w-0 lg:col-span-2">
              <Card className="border-none shadow-lg">
                <CardHeader>
                  <CardTitle>Current Holdings</CardTitle>
                  <CardDescription>Your recorded investments</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingInv ? (
                    <p className="text-center py-8 text-muted-foreground">Loading portfolio...</p>
                  ) : investments && investments.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Symbol</TableHead>
                          <TableHead>Shares</TableHead>
                          <TableHead>Avg Price</TableHead>
                          <TableHead>Stored Price</TableHead>
                          <TableHead className="text-right">Stored Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {investments.map((inv) => {
                          const marketValue = Number(inv.shares) * Number(inv.currentPrice ?? inv.purchasePrice);
                          return (
                            <TableRow key={inv.id}>
                              <TableCell className="font-bold">{inv.symbol}</TableCell>
                              <TableCell>{Number(inv.shares).toFixed(4)}</TableCell>
                              <TableCell>{formatBalance(inv.purchasePrice,clientBalanceCurrency(user))}</TableCell>
                              <TableCell>{formatBalance(inv.currentPrice ?? inv.purchasePrice,clientBalanceCurrency(user))}</TableCell>
                              <TableCell className="text-right font-medium">
                                {formatBalance(marketValue,clientBalanceCurrency(user))}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-center py-8 text-muted-foreground">No holdings yet</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ETF/Fractional Trading */}
        <TabsContent value="etfs" className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <Card className="border-none shadow-xl shadow-primary/5 overflow-hidden">
                <div className="bg-primary/5 p-6 border-b border-primary/10">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-2xl font-bold">{selectedETF}</h3>
                      <p className="text-sm text-muted-foreground">ETF</p>
                    </div>
                  </div>
                  
                  <Select value={selectedETF} onValueChange={setSelectedETF}>
                    <SelectTrigger className="bg-background h-10">
                      <SelectValue placeholder="Select ETF" />
                    </SelectTrigger>
                    <SelectContent>
                      {ETFS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <CardContent className="p-6 space-y-4">
                  <div>
                    <Label className="text-xs mb-2 block">Account</Label>
                    <Select value={etfAccount} onValueChange={setEtfAccount}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select Account" />
                      </SelectTrigger>
                      <SelectContent>
                        {investmentAccounts.map(a => (
                          <SelectItem key={a.id} value={a.id.toString()}>
                            {accountLabel(a)} ({formatBalance(a.balance,clientBalanceCurrency(user))})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Invest Amount ($)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                      <Input 
                        type="number" 
                        placeholder="Any amount - fractional shares" 
                        className="pl-7"
                        value={etfAmount}
                        onChange={e => setEtfAmount(e.target.value)}
                      />
                    </div>
                  </div>

                  <Button 
                    data-funds-action=""
                    className="w-full bg-blue-600 hover:bg-blue-700" 
                    onClick={handleFractionalBuy}
                    disabled={pricingBlocked && !access.blocked}
                  >
                    Buy Fractional Shares
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2">
              <Card className="border-none shadow-lg">
                <CardHeader>
                  <CardTitle>Popular ETFs</CardTitle>
                  <CardDescription>ETF symbols for reference</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { symbol: "SPY", name: "S&P 500 ETF" },
                      { symbol: "QQQ", name: "Nasdaq-100 ETF" },
                      { symbol: "IVV", name: "Core S&P 500 ETF" },
                      { symbol: "VOO", name: "Vanguard S&P 500" },
                      { symbol: "VTI", name: "Total Stock Market" },
                    ].map(etf => (
                      <div key={etf.symbol} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50">
                        <div>
                          <p className="font-semibold text-sm">{etf.symbol}</p>
                          <p className="text-xs text-muted-foreground">{etf.name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Cash Management */}
        <TabsContent value="cash" className="space-y-6">
          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary" />
                Cash Management
              </CardTitle>
              <CardDescription>Cash balances held in your investment accounts.</CardDescription>
            </CardHeader>
            <CardContent>
              <Card className="bg-muted/30">
                <CardHeader>
                  <CardTitle className="text-base">Your Cash Positions</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead>Cash Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {investmentAccounts.map(a => {
                        const balance = Number(a.balance);
                        return (
                          <TableRow key={a.id}>
                            <TableCell>{accountLabel(a)}</TableCell>
                            <TableCell>{formatBalance(balance,clientBalanceCurrency(user))}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </LayoutShell>
  );
}
