import { useInvestments, useAccounts, useBuyInvestment, useSellInvestment, useMarketQuote } from "@/hooks/use-finances";
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
import { useToast } from "@/hooks/use-toast";
import { ArrowUp, ArrowDown, TrendingUp, BookOpen, Zap, DollarSign, Settings, Zap as ZapIcon } from "lucide-react";

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
  { title: "Understanding ETFs vs Mutual Funds", category: "Education", date: "Dec 22, 2025" },
  { title: "Tax-Loss Harvesting Explained", category: "Tax Planning", date: "Dec 21, 2025" },
  { title: "Options Trading 101: Calls and Puts", category: "Options Education", date: "Dec 25, 2025" },
  { title: "Advanced Order Types Guide", category: "Trading Tools", date: "Dec 24, 2025" },
  { title: "Risk Management Strategies", category: "Risk", date: "Dec 23, 2025" },
  { title: "Technical Analysis Mastery", category: "Technical Analysis", date: "Dec 22, 2025" },
];

const EDUCATION_COURSES = [
  { id: 1, title: "Getting Started with Stocks", level: "Beginner", duration: "2 hours", completion: 100 },
  { id: 2, title: "Advanced Portfolio Management", level: "Advanced", duration: "4 hours", completion: 45 },
  { id: 3, title: "Options Trading Strategies", level: "Intermediate", duration: "3 hours", completion: 0 },
  { id: 4, title: "Financial Planning Essentials", level: "Beginner", duration: "1.5 hours", completion: 75 },
  { id: 5, title: "Tax-Efficient Investing", level: "Intermediate", duration: "2.5 hours", completion: 30 },
];

export default function InvestmentsPage() {
  const { data: investments, isLoading: loadingInv } = useInvestments();
  const { data: accounts } = useAccounts();
  const buyMutation = useBuyInvestment();
  const sellMutation = useSellInvestment();
  const { toast } = useToast();

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

  // Market data
  const { data: quote } = useMarketQuote(selectedSymbol);
  const { data: etfQuote } = useMarketQuote(selectedETF);

  const investmentAccounts = accounts?.filter(a => 
    ['Brokerage Account', 'Traditional IRA', 'Roth IRA', '401(k) / 403(b)', '529 Savings Plan'].includes(a.accountType)
  ) || [];

  const handleBuy = () => {
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
    if (!etfAccount) {
      toast({ title: "Select an account", variant: "destructive" });
      return;
    }
    toast({ 
      title: "Fractional Share Order Placed", 
      description: `Buying $${etfAmount} of ${selectedETF} - fractional shares purchased successfully.` 
    });
    setEtfAmount("");
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
      {/* Hero background section */}
      <div className="relative -mx-4 -mt-4 mb-8 px-4 py-8 rounded-lg overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-15"
          style={{ backgroundImage: 'url(/assets/IMG_3476_1766680873153.jpeg)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/30 to-accent/20" />
        <div className="relative">
          <h2 className="text-3xl font-bold font-display">Investments</h2>
          <p className="text-muted-foreground">Trade stocks, ETFs, access research, and manage your portfolio.</p>
        </div>
      </div>

      <Tabs defaultValue="stocks" className="w-full">
        <TabsList className="grid w-full grid-cols-7 mb-6 overflow-x-auto">
          <TabsTrigger value="stocks" className="gap-2 text-xs sm:text-sm">
            <TrendingUp className="w-4 h-4" />
            <span className="hidden sm:inline">Stocks</span>
          </TabsTrigger>
          <TabsTrigger value="etfs" className="gap-2 text-xs sm:text-sm">
            <DollarSign className="w-4 h-4" />
            <span className="hidden sm:inline">ETFs</span>
          </TabsTrigger>
          <TabsTrigger value="options" className="gap-2 text-xs sm:text-sm">
            <ZapIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Options</span>
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-2 text-xs sm:text-sm">
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Orders</span>
          </TabsTrigger>
          <TabsTrigger value="robo" className="gap-2 text-xs sm:text-sm">
            <Zap className="w-4 h-4" />
            <span className="hidden sm:inline">Robo</span>
          </TabsTrigger>
          <TabsTrigger value="research" className="gap-2 text-xs sm:text-sm">
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Research</span>
          </TabsTrigger>
          <TabsTrigger value="cash" className="gap-2 text-xs sm:text-sm">
            <DollarSign className="w-4 h-4" />
            <span className="hidden sm:inline">Cash</span>
          </TabsTrigger>
        </TabsList>

        {/* Stock Trading */}
        <TabsContent value="stocks" className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Trading Panel */}
            <div className="lg:col-span-1">
              <Card className="border-none shadow-xl shadow-primary/5 overflow-hidden">
                <div className="bg-primary/5 p-6 border-b border-primary/10">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-2xl font-bold">{selectedSymbol}</h3>
                      <p className="text-sm text-muted-foreground">Stock Quote</p>
                    </div>
                    {quote && (
                      <div className={`text-right ${quote.change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        <p className="text-2xl font-bold">${quote.price.toFixed(2)}</p>
                        <p className="text-sm font-medium flex items-center justify-end gap-1">
                          {quote.change >= 0 ? <ArrowUp className="w-3 h-3"/> : <ArrowDown className="w-3 h-3"/>}
                          {quote.changePercent.toFixed(2)}%
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
                    <SelectTrigger className="bg-background">
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
                      <SelectTrigger>
                        <SelectValue placeholder="Select Account" />
                      </SelectTrigger>
                      <SelectContent>
                        {investmentAccounts.map(a => (
                          <SelectItem key={a.id} value={a.id.toString()}>
                            Account #{a.id} (${Number(a.balance).toFixed(0)})
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
                        className="w-full bg-emerald-600 hover:bg-emerald-700" 
                        onClick={handleBuy}
                        disabled={buyMutation.isPending}
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
                        className="w-full bg-rose-600 hover:bg-rose-700" 
                        onClick={handleSell}
                        disabled={sellMutation.isPending}
                      >
                        {sellMutation.isPending ? "Processing..." : "Sell Shares"}
                      </Button>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            {/* Portfolio Table */}
            <div className="lg:col-span-2">
              <Card className="border-none shadow-lg">
                <CardHeader>
                  <CardTitle>Current Holdings</CardTitle>
                  <CardDescription>Your stock positions</CardDescription>
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
                          <TableHead>Current Price</TableHead>
                          <TableHead className="text-right">Market Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {investments.map((inv) => {
                          const marketValue = Number(inv.shares) * Number(inv.currentPrice || inv.purchasePrice);
                          const gain = Number(inv.currentPrice) - Number(inv.purchasePrice);
                          return (
                            <TableRow key={inv.id}>
                              <TableCell className="font-bold">{inv.symbol}</TableCell>
                              <TableCell>{Number(inv.shares).toFixed(4)}</TableCell>
                              <TableCell>${Number(inv.purchasePrice).toFixed(2)}</TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span>${Number(inv.currentPrice || inv.purchasePrice).toFixed(2)}</span>
                                  {gain !== 0 && (
                                    <span className={`text-xs ${gain > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                      {gain > 0 ? '+' : ''}{((gain / Number(inv.purchasePrice)) * 100).toFixed(2)}%
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                ${marketValue.toFixed(2)}
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

        {/* Options Trading */}
        <TabsContent value="options" className="space-y-6">
          <Card className="border-none shadow-xl shadow-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ZapIcon className="w-5 h-5 text-primary" />
                Options Trading
              </CardTitle>
              <CardDescription>Trade calls and puts with flexible strike prices and expiration dates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label>Stock Symbol</Label>
                    <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STOCKS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Contract Type</Label>
                    <div className="flex gap-2">
                      <Button 
                        variant={optionType === 'call' ? 'default' : 'outline'}
                        className="flex-1"
                        onClick={() => setOptionType('call')}
                      >
                        Call
                      </Button>
                      <Button 
                        variant={optionType === 'put' ? 'default' : 'outline'}
                        className="flex-1"
                        onClick={() => setOptionType('put')}
                      >
                        Put
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label>Strike Price ($)</Label>
                    <Input 
                      type="number"
                      placeholder="150.00"
                      value={strikePrice}
                      onChange={(e) => setStrikePrice(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Expiration Date</Label>
                    <Input 
                      type="date"
                      value={expiration}
                      onChange={(e) => setExpiration(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Account</Label>
                    <Select value={optionAccount} onValueChange={setOptionAccount}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {investmentAccounts.map(a => (
                          <SelectItem key={a.id} value={a.id.toString()}>
                            Account #{a.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button className="w-full bg-orange-600 hover:bg-orange-700" onClick={handlePlaceOption} data-testid="button-place-options-order">
                    Place Options Order
                  </Button>
                </div>

                <div className="lg:col-span-2 space-y-4">
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <h4 className="font-semibold text-sm mb-2 text-amber-900 dark:text-amber-100">Options Basics</h4>
                    <ul className="text-sm space-y-2 text-amber-800 dark:text-amber-200">
                      <li><strong>Calls:</strong> Bet that the stock price will rise above the strike price</li>
                      <li><strong>Puts:</strong> Bet that the stock price will fall below the strike price</li>
                      <li><strong>Leverage:</strong> Control 100 shares with less capital than buying stock outright</li>
                      <li><strong>Risk:</strong> Your risk is limited to the premium paid (the option price)</li>
                      <li><strong>Expiration:</strong> Options expire on the date you select - choose wisely</li>
                    </ul>
                  </div>

                  <Card className="bg-muted/30">
                    <CardHeader>
                      <CardTitle className="text-base">Available Options Chains</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        {[145, 150, 155, 160, 165].map(strike => (
                          <div key={strike} className="flex justify-between items-center p-2 rounded border">
                            <span>${strike}.00 {optionType === 'call' ? 'Call' : 'Put'}</span>
                            <span className="font-semibold text-primary">${(Math.random() * 5 + 1).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advanced Orders */}
        <TabsContent value="orders" className="space-y-6">
          <Card className="border-none shadow-xl shadow-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" />
                Advanced Order Types
              </CardTitle>
              <CardDescription>Set sophisticated trading rules to execute automatically</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label>Stock Symbol</Label>
                    <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STOCKS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Order Type</Label>
                    <Select value={orderType} onValueChange={setOrderType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="market">Market Order</SelectItem>
                        <SelectItem value="limit">Limit Order</SelectItem>
                        <SelectItem value="stop">Stop-Loss</SelectItem>
                        <SelectItem value="stop-limit">Stop-Limit</SelectItem>
                        <SelectItem value="trailing">Trailing Stop</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {orderType === 'limit' && (
                    <div className="grid gap-2">
                      <Label>Limit Price ($)</Label>
                      <Input 
                        type="number"
                        placeholder="Buy/sell at this price or better"
                        value={limitPrice}
                        onChange={(e) => setLimitPrice(e.target.value)}
                      />
                    </div>
                  )}

                  {(orderType === 'stop' || orderType === 'stop-limit') && (
                    <div className="grid gap-2">
                      <Label>Stop Price ($)</Label>
                      <Input 
                        type="number"
                        placeholder="Trigger price"
                        value={stopPrice}
                        onChange={(e) => setStopPrice(e.target.value)}
                      />
                    </div>
                  )}

                  {orderType === 'trailing' && (
                    <div className="grid gap-2">
                      <Label>Trailing Stop (%)</Label>
                      <Input 
                        type="number"
                        placeholder="e.g., 5 for 5%"
                        value={trailingPercent}
                        onChange={(e) => setTrailingPercent(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="grid gap-2">
                    <Label>Account</Label>
                    <Select value={orderAccount} onValueChange={setOrderAccount}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {investmentAccounts.map(a => (
                          <SelectItem key={a.id} value={a.id.toString()}>
                            Account #{a.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handlePlaceOrder} data-testid="button-place-advanced-order">
                    Place Order
                  </Button>
                </div>

                <div className="space-y-4">
                  <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                    <CardHeader>
                      <CardTitle className="text-base">Order Type Guide</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div>
                        <p className="font-semibold text-blue-900 dark:text-blue-100">Limit Order</p>
                        <p className="text-blue-800 dark:text-blue-200">Only execute at your specified price or better</p>
                      </div>
                      <div>
                        <p className="font-semibold text-blue-900 dark:text-blue-100">Stop-Loss</p>
                        <p className="text-blue-800 dark:text-blue-200">Sell automatically if price falls below trigger</p>
                      </div>
                      <div>
                        <p className="font-semibold text-blue-900 dark:text-blue-100">Trailing Stop</p>
                        <p className="text-blue-800 dark:text-blue-200">Automatically lock in gains with percentage trailing</p>
                      </div>
                      <div>
                        <p className="font-semibold text-blue-900 dark:text-blue-100">Stop-Limit</p>
                        <p className="text-blue-800 dark:text-blue-200">Combine stop trigger with limit price protection</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-muted/30">
                    <CardHeader>
                      <CardTitle className="text-base">Your Active Orders</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">No active advanced orders</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
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
                      <p className="text-sm text-muted-foreground">ETF - Fractional Shares Available</p>
                    </div>
                    {etfQuote && (
                      <div className={`text-right ${etfQuote.change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        <p className="text-2xl font-bold">${etfQuote.price.toFixed(2)}</p>
                        <p className="text-sm font-medium flex items-center justify-end gap-1">
                          {etfQuote.change >= 0 ? <ArrowUp className="w-3 h-3"/> : <ArrowDown className="w-3 h-3"/>}
                          {etfQuote.changePercent.toFixed(2)}%
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <Select value={selectedETF} onValueChange={setSelectedETF}>
                    <SelectTrigger className="bg-background">
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
                      <SelectTrigger>
                        <SelectValue placeholder="Select Account" />
                      </SelectTrigger>
                      <SelectContent>
                        {investmentAccounts.map(a => (
                          <SelectItem key={a.id} value={a.id.toString()}>
                            Account #{a.id} (${Number(a.balance).toFixed(0)})
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
                    <p className="text-xs text-muted-foreground mt-2">Invest any amount. You'll automatically receive fractional shares.</p>
                  </div>

                  <Button 
                    className="w-full bg-blue-600 hover:bg-blue-700" 
                    onClick={handleFractionalBuy}
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
                  <CardDescription>Low-cost diversified investment options</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { symbol: "SPY", name: "S&P 500 ETF", expense: "0.03%" },
                      { symbol: "QQQ", name: "Nasdaq-100 ETF", expense: "0.20%" },
                      { symbol: "IVV", name: "Core S&P 500 ETF", expense: "0.03%" },
                      { symbol: "VOO", name: "Vanguard S&P 500", expense: "0.03%" },
                      { symbol: "VTI", name: "Total Stock Market", expense: "0.03%" },
                    ].map(etf => (
                      <div key={etf.symbol} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50">
                        <div>
                          <p className="font-semibold text-sm">{etf.symbol}</p>
                          <p className="text-xs text-muted-foreground">{etf.name}</p>
                        </div>
                        <Badge variant="outline">Exp: {etf.expense}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Robo-Advisor */}
        <TabsContent value="robo" className="space-y-6">
          <Card className="border-none shadow-xl shadow-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                Automated Portfolio Management
              </CardTitle>
              <CardDescription>Set your risk tolerance and let our algorithm manage your portfolio automatically</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Select Your Portfolio</Label>
                  {ROBO_PORTFOLIOS.map(portfolio => (
                    <div 
                      key={portfolio.id}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        selectedRobo === portfolio.id 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedRobo(portfolio.id)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-semibold">{portfolio.name}</h4>
                          <p className="text-sm text-muted-foreground">{portfolio.allocation}</p>
                        </div>
                        <Badge variant={portfolio.risk === 'Low' ? 'secondary' : 'default'}>
                          {portfolio.risk} Risk
                        </Badge>
                      </div>
                    </div>
                  ))}

                  <div className="pt-4">
                    <Label className="text-base font-semibold mb-2 block">Choose Account</Label>
                    <Select value={roboAccount} onValueChange={setRoboAccount}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {investmentAccounts.map(a => (
                          <SelectItem key={a.id} value={a.id.toString()}>
                            Account #{a.id} (${Number(a.balance).toFixed(0)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button 
                    className="w-full mt-4 bg-purple-600 hover:bg-purple-700"
                    onClick={handleRoboSetup}
                  >
                    Activate Robo-Advisor
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                    <h4 className="font-semibold text-sm mb-2">How It Works</h4>
                    <ul className="text-sm space-y-2 text-muted-foreground">
                      <li>✓ Automatic allocation based on your risk tolerance</li>
                      <li>✓ Quarterly rebalancing to maintain target allocation</li>
                      <li>✓ Tax-loss harvesting to reduce your tax burden</li>
                      <li>✓ Low-cost diversified portfolio</li>
                      <li>✓ Professional management 24/7</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Research & Education */}
        <TabsContent value="research" className="space-y-6">
          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                Investment Research & Education
              </CardTitle>
              <CardDescription>Learn from expert analysis and educational content</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                {RESEARCH_ARTICLES.map((article, idx) => (
                  <div 
                    key={idx}
                    className="p-4 rounded-lg border hover:border-primary/50 hover:bg-muted/30 transition-all cursor-pointer group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <Badge variant="outline" className="text-xs">{article.category}</Badge>
                      <span className="text-xs text-muted-foreground">{article.date}</span>
                    </div>
                    <h4 className="font-semibold group-hover:text-primary transition-colors">{article.title}</h4>
                    <Button variant="ghost" size="sm" className="mt-3 p-0 h-auto">
                      Read More →
                    </Button>
                  </div>
                ))}
              </div>

              <div className="mt-8">
                <h3 className="text-lg font-semibold mb-4">Investment Academy - Courses</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {EDUCATION_COURSES.map(course => (
                    <Card key={course.id} className="hover:border-primary/50">
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-semibold text-sm">{course.title}</h4>
                            <p className="text-xs text-muted-foreground">{course.duration}</p>
                          </div>
                          <Badge variant="outline" className="text-xs">{course.level}</Badge>
                        </div>
                        {course.completion > 0 && (
                          <div className="mt-3">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-muted-foreground">Progress</span>
                              <span className="font-medium">{course.completion}%</span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                              <div 
                                className="bg-primary h-full"
                                style={{ width: `${course.completion}%` }}
                              />
                            </div>
                          </div>
                        )}
                        <Button variant={course.completion > 0 ? 'outline' : 'default'} size="sm" className="w-full mt-3">
                          {course.completion > 0 ? 'Continue' : 'Start'} Course
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cash Management */}
        <TabsContent value="cash" className="space-y-6">
          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary" />
                Cash Management & Money Market
              </CardTitle>
              <CardDescription>Earn yield on your cash while maintaining liquidity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">High-Yield Cash Sweep</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Current APY</p>
                      <p className="text-3xl font-bold text-green-600">4.85%</p>
                    </div>
                    <p className="text-sm text-muted-foreground">FDIC insured up to $250k per bank partner</p>
                    <Button className="w-full mt-4">Enable Cash Sweep</Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Money Market Fund</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Current Yield</p>
                      <p className="text-3xl font-bold text-blue-600">4.65%</p>
                    </div>
                    <p className="text-sm text-muted-foreground">Low-risk investment with daily liquidity</p>
                    <Button className="w-full mt-4" variant="outline">Invest</Button>
                  </CardContent>
                </Card>
              </div>

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
                        <TableHead>APY</TableHead>
                        <TableHead>Monthly Interest</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {investmentAccounts.map(a => {
                        const balance = Number(a.balance);
                        const apy = 0.0485;
                        const monthlyInterest = (balance * apy) / 12;
                        return (
                          <TableRow key={a.id}>
                            <TableCell>Account #{a.id}</TableCell>
                            <TableCell>${balance.toFixed(2)}</TableCell>
                            <TableCell>{(apy * 100).toFixed(2)}%</TableCell>
                            <TableCell className="font-medium text-green-600">+${monthlyInterest.toFixed(2)}</TableCell>
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
