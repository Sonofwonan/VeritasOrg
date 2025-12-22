import { useInvestments, useAccounts, useBuyInvestment, useSellInvestment, useMarketQuote } from "@/hooks/use-finances";
import { LayoutShell } from "@/components/layout-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { ArrowUp, ArrowDown, Search } from "lucide-react";

const STOCKS = ["AAPL", "GOOGL", "TSLA", "AMZN", "MSFT"];

export default function InvestmentsPage() {
  const { data: investments, isLoading: loadingInv } = useInvestments();
  const { data: accounts } = useAccounts();
  const buyMutation = useBuyInvestment();
  const sellMutation = useSellInvestment();
  const { toast } = useToast();

  const [selectedSymbol, setSelectedSymbol] = useState("AAPL");
  const [amount, setAmount] = useState("");
  const [shares, setShares] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<string>("");

  // Market data for selected symbol
  const { data: quote } = useMarketQuote(selectedSymbol);

  const investmentAccounts = accounts?.filter(a => a.accountType === "investment") || [];

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

  return (
    <LayoutShell>
      <div className="mb-8">
        <h2 className="text-3xl font-bold font-display">Investments</h2>
        <p className="text-muted-foreground">Manage your portfolio and trade stocks.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Trading Panel */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-none shadow-xl shadow-primary/5 overflow-hidden">
            <div className="bg-primary/5 p-6 border-b border-primary/10">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-2xl font-bold">{selectedSymbol}</h3>
                  <p className="text-sm text-muted-foreground">Real-time Quote</p>
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
                    <SelectValue placeholder="Select Brokerage Account" />
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
                    {buyMutation.isPending ? "Processing..." : "Execute Buy Order"}
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
                    {sellMutation.isPending ? "Processing..." : "Execute Sell Order"}
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
              <CardDescription>Your active positions across all accounts</CardDescription>
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
                <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg">
                  <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>No active investments found.</p>
                  <Button variant="link" onClick={() => document.querySelector<HTMLInputElement>('input[type="number"]')?.focus()}>
                    Make your first trade
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </LayoutShell>
  );
}
