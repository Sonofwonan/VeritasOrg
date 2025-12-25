import { useAccounts, useTransfer } from "@/hooks/use-finances";
import { LayoutShell } from "@/components/layout-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRight, ArrowRightLeft, Plus } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function TransfersPage() {
  const { data: accounts } = useAccounts();
  const transferMutation = useTransfer();
  const { toast } = useToast();

  // Internal Transfer State
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");

  // External Payment State
  const [payeeAccount, setPayeeAccount] = useState("");
  const [payeeAmount, setPayeeAmount] = useState("");
  const [payeeName, setPayeeName] = useState("");
  const [payeeBankName, setPayeeBankName] = useState("");
  const [payeeAccountNumber, setPayeeAccountNumber] = useState("");
  const [payeeRoutingNumber, setPayeeRoutingNumber] = useState("");

  // Saved Payees (mock data - in real app would come from database)
  const [savedPayees, setSavedPayees] = useState<any[]>([
    { id: 1, name: "Sarah's Consulting", bankName: "Chase", accountNumber: "****5678", routingNumber: "121000248" },
    { id: 2, name: "Utility Company", bankName: "Bank of America", accountNumber: "****1234", routingNumber: "026009593" },
  ]);

  const [isPayeeDialogOpen, setIsPayeeDialogOpen] = useState(false);

  const handleInternalTransfer = () => {
    if (!fromId || !toId || !amount) {
      toast({ title: "Incomplete form", description: "Please fill all fields", variant: "destructive" });
      return;
    }

    if (fromId === toId) {
      toast({ title: "Invalid selection", description: "Cannot transfer to the same account", variant: "destructive" });
      return;
    }

    transferMutation.mutate({
      fromAccountId: parseInt(fromId),
      toAccountId: parseInt(toId),
      amount: amount
    }, {
      onSuccess: () => {
        toast({ title: "Transfer Successful", description: `$${amount} has been transferred.` });
        setAmount("");
        setFromId("");
        setToId("");
      },
      onError: (err) => {
        toast({ title: "Transfer Failed", description: err.message, variant: "destructive" });
      }
    });
  };

  const handleAddPayee = () => {
    if (!payeeName || !payeeBankName || !payeeAccountNumber || !payeeRoutingNumber) {
      toast({ title: "Incomplete form", description: "Please fill all payee details", variant: "destructive" });
      return;
    }

    const newPayee = {
      id: Math.max(...savedPayees.map(p => p.id), 0) + 1,
      name: payeeName,
      bankName: payeeBankName,
      accountNumber: `****${payeeAccountNumber.slice(-4)}`,
      routingNumber: payeeRoutingNumber,
    };

    setSavedPayees([...savedPayees, newPayee]);
    setIsPayeeDialogOpen(false);
    setPayeeName("");
    setPayeeBankName("");
    setPayeeAccountNumber("");
    setPayeeRoutingNumber("");
    
    toast({ title: "Payee Added", description: `${payeeName} has been saved.` });
  };

  const handleExternalPayment = () => {
    if (!payeeAccount || !payeeAmount) {
      toast({ title: "Incomplete form", description: "Please select a payee and enter amount", variant: "destructive" });
      return;
    }

    const selectedPayee = savedPayees.find(p => p.id === parseInt(payeeAccount));
    if (!selectedPayee) {
      toast({ title: "Invalid payee", description: "Please select a valid payee", variant: "destructive" });
      return;
    }

    // In a real app, this would make an API call to create external payment
    toast({ 
      title: "Payment Scheduled", 
      description: `$${payeeAmount} payment to ${selectedPayee.name} has been scheduled for processing.`,
      variant: "default"
    });
    
    setPayeeAmount("");
    setPayeeAccount("");
  };

  return (
    <LayoutShell>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h2 className="text-3xl font-bold font-display">Transfers & Payments</h2>
          <p className="text-muted-foreground">Move money between your accounts or send payments to external recipients.</p>
        </div>

        <Tabs defaultValue="internal" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="internal" className="gap-2">
              <ArrowRightLeft className="w-4 h-4" />
              Internal Transfer
            </TabsTrigger>
            <TabsTrigger value="external" className="gap-2">
              <ArrowRight className="w-4 h-4" />
              External Payment
            </TabsTrigger>
          </TabsList>

          {/* Internal Transfer Tab */}
          <TabsContent value="internal" className="mt-6">
            <Card className="border-none shadow-xl shadow-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowRightLeft className="w-5 h-5 text-primary" />
                  Transfer Between Accounts
                </CardTitle>
                <CardDescription>Move money between your own accounts instantly</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-[1fr,auto,1fr] gap-4 items-center">
                  <div className="space-y-2">
                    <Label>From Account</Label>
                    <Select value={fromId} onValueChange={setFromId}>
                      <SelectTrigger className="h-14">
                        <SelectValue placeholder="Select Source" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts?.map(a => (
                          <SelectItem key={a.id} value={a.id.toString()}>
                            <div className="text-left">
                              <p className="font-medium">Account #{a.id}</p>
                              <p className="text-xs text-muted-foreground">${Number(a.balance).toFixed(2)}</p>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex justify-center pt-6">
                    <div className="bg-muted p-2 rounded-full">
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>To Account</Label>
                    <Select value={toId} onValueChange={setToId}>
                      <SelectTrigger className="h-14">
                        <SelectValue placeholder="Select Destination" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts?.map(a => (
                          <SelectItem key={a.id} value={a.id.toString()}>
                            <div className="text-left">
                              <p className="font-medium">Account #{a.id}</p>
                              <p className="text-xs text-muted-foreground">${Number(a.balance).toFixed(2)}</p>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">$</span>
                    <Input 
                      type="number" 
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      className="pl-8 h-14 text-lg font-bold"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <Button 
                  className="w-full h-12 text-lg shadow-lg shadow-primary/25" 
                  onClick={handleInternalTransfer}
                  disabled={transferMutation.isPending}
                >
                  {transferMutation.isPending ? "Processing..." : "Transfer Funds"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* External Payment Tab */}
          <TabsContent value="external" className="mt-6 space-y-6">
            <Card className="border-none shadow-xl shadow-primary/5">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ArrowRight className="w-5 h-5 text-primary" />
                      Send Payment to Payee
                    </CardTitle>
                    <CardDescription>Send money to external recipients</CardDescription>
                  </div>
                  <Dialog open={isPayeeDialogOpen} onOpenChange={setIsPayeeDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Plus className="w-4 h-4" />
                        Add Payee
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add New Payee</DialogTitle>
                        <DialogDescription>
                          Save a new external recipient for future payments
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid gap-2">
                          <Label>Payee Name</Label>
                          <Input 
                            placeholder="e.g., Sarah's Consulting"
                            value={payeeName}
                            onChange={(e) => setPayeeName(e.target.value)}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Bank Name</Label>
                          <Input 
                            placeholder="e.g., Chase Bank"
                            value={payeeBankName}
                            onChange={(e) => setPayeeBankName(e.target.value)}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Account Number</Label>
                          <Input 
                            placeholder="Account number"
                            type="password"
                            value={payeeAccountNumber}
                            onChange={(e) => setPayeeAccountNumber(e.target.value)}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Routing Number</Label>
                          <Input 
                            placeholder="Routing number"
                            value={payeeRoutingNumber}
                            onChange={(e) => setPayeeRoutingNumber(e.target.value)}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={handleAddPayee}>Save Payee</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>From Account</Label>
                  <Select value={payeeAccount.split('-')[0] || ""} onValueChange={(val) => setPayeeAccount(val)}>
                    <SelectTrigger className="h-14">
                      <SelectValue placeholder="Select Source Account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts?.map(a => (
                        <SelectItem key={a.id} value={a.id.toString()}>
                          <div className="text-left">
                            <p className="font-medium">Account #{a.id}</p>
                            <p className="text-xs text-muted-foreground">${Number(a.balance).toFixed(2)}</p>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Payee</Label>
                  <Select value={payeeAccount.split('-')[1] || ""} onValueChange={(val) => setPayeeAccount((payeeAccount.split('-')[0] || "") + "-" + val)}>
                    <SelectTrigger className="h-14">
                      <SelectValue placeholder="Select Payee" />
                    </SelectTrigger>
                    <SelectContent>
                      {savedPayees.map(payee => (
                        <SelectItem key={payee.id} value={payee.id.toString()}>
                          <div className="text-left">
                            <p className="font-medium">{payee.name}</p>
                            <p className="text-xs text-muted-foreground">{payee.bankName} - {payee.accountNumber}</p>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">$</span>
                    <Input 
                      type="number" 
                      value={payeeAmount}
                      onChange={e => setPayeeAmount(e.target.value)}
                      className="pl-8 h-14 text-lg font-bold"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <Button 
                  className="w-full h-12 text-lg shadow-lg shadow-primary/25" 
                  onClick={handleExternalPayment}
                >
                  Schedule Payment
                </Button>

                {savedPayees.length > 0 && (
                  <div className="bg-muted/30 rounded-lg p-4 border border-border">
                    <h3 className="font-semibold mb-3 text-sm">Saved Payees</h3>
                    <div className="space-y-2">
                      {savedPayees.map(payee => (
                        <div key={payee.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                          <div>
                            <p className="font-medium text-sm">{payee.name}</p>
                            <p className="text-xs text-muted-foreground">{payee.bankName} - {payee.accountNumber}</p>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setPayeeAccount("account-" + payee.id)}
                          >
                            Select
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </LayoutShell>
  );
}
