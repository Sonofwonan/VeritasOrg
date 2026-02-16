import { useAccounts, useTransfer, usePayees, useCreatePayee, useDeletePayee, usePayment, useDeleteAccount } from "@/hooks/use-finances";
import { LayoutShell } from "@/components/layout-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRight, ArrowRightLeft, Plus, Wallet } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function TransfersPage() {
  const { data: accounts } = useAccounts();
  const { data: savedPayees, isLoading: loadingPayees } = usePayees();
  const transferMutation = useTransfer();
  const createPayeeMutation = useCreatePayee();
  const deletePayeeMutation = useDeletePayee();
  const paymentMutation = usePayment();
  const deleteAccountMutation = useDeleteAccount();
  const { toast } = useToast();

  // Internal Transfer State
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");

  // External Payment State
  const [payeeId, setPayeeId] = useState("");
  const [payeeAmount, setPayeeAmount] = useState("");
  const [fromAccountForPayee, setFromAccountForPayee] = useState("");
  
  // Payee Dialog State
  const [payeeName, setPayeeName] = useState("");
  const [payeeBankName, setPayeeBankName] = useState("");
  const [payeeAccountNumber, setPayeeAccountNumber] = useState("");
  const [payeeRoutingNumber, setPayeeRoutingNumber] = useState("");
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
        toast({ 
          title: "Transfer Initiated", 
          description: "Your transfer has been initiated and pending approval. We'll get back to you if we need further verification, but for the meantime give us sometime to review your tax information and investment account portfolio.",
          duration: 10000 
        });
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

    createPayeeMutation.mutate({
      name: payeeName,
      bankName: payeeBankName,
      accountNumber: payeeAccountNumber,
      routingNumber: payeeRoutingNumber,
      userId: 0, // Will be overridden by server
      type: "individual"
    }, {
      onSuccess: () => {
        setIsPayeeDialogOpen(false);
        setPayeeName("");
        setPayeeBankName("");
        setPayeeAccountNumber("");
        setPayeeRoutingNumber("");
        toast({ title: "Payee Added", description: `${payeeName} has been saved.` });
      }
    });
  };

  const handleExternalPayment = () => {
    if (!fromAccountForPayee || !payeeId || !payeeAmount) {
      toast({ title: "Incomplete form", description: "Please select an account, payee and enter amount", variant: "destructive" });
      return;
    }

    paymentMutation.mutate({
      fromAccountId: parseInt(fromAccountForPayee),
      payeeId: parseInt(payeeId),
      amount: payeeAmount,
      description: `Payment to ${payeeName}`
    }, {
      onSuccess: () => {
        toast({ 
          title: "Transfer Initiated", 
          description: "Your transfer has been initiated and pending approval. We'll get back to you if we need further verification, but for the meantime give us sometime to review your tax information and investment account portfolio.",
          duration: 10000 
        });
        setPayeeAmount("");
        setPayeeId("");
        setFromAccountForPayee("");
      }
    });
  };

  return (
    <LayoutShell>
      <div className="max-w-4xl mx-auto">
        <div className="mb-3">
          <h2 className="text-xl font-bold font-display">Transfers & Payments</h2>
          <p className="text-muted-foreground text-xs">Move money between your accounts or send payments to external recipients.</p>
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
          <TabsContent value="internal" className="mt-2">
            <Card className="border-none shadow-xl shadow-primary/5">
              <CardHeader className="p-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <ArrowRightLeft className="w-4 h-4 text-primary" />
                  Transfer Between Accounts
                </CardTitle>
                <CardDescription className="text-xs">Move money between your own accounts instantly</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 p-3 pt-0">
                <div className="grid md:grid-cols-[1fr,auto,1fr] gap-2 items-center">
                  <div className="space-y-1">
                    <Label className="text-xs">From Account</Label>
                    <Select value={fromId} onValueChange={setFromId}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Select Source" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts?.map((a: any) => (
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

                  <div className="flex justify-center pt-3">
                    <div className="bg-muted p-1 rounded-full">
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">To Account</Label>
                    <Select value={toId} onValueChange={setToId}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Select Destination" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts?.map((a: any) => (
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

                <div className="space-y-1">
                  <Label className="text-xs">Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">$</span>
                    <Input 
                      type="number" 
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      className="pl-6 h-9 text-sm font-bold"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <Button 
                  className="w-full h-9 text-sm shadow-lg shadow-primary/25" 
                  onClick={handleInternalTransfer}
                  disabled={transferMutation.isPending}
                >
                  {transferMutation.isPending ? "Processing..." : "Transfer Funds"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* External Payment Tab */}
          <TabsContent value="external" className="mt-2 space-y-2">
            <Card className="border-none shadow-xl shadow-primary/5">
              <CardHeader className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <ArrowRight className="w-4 h-4 text-primary" />
                      Send Payment to Payee
                    </CardTitle>
                    <CardDescription className="text-xs">Send money to external recipients</CardDescription>
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
                        <Button onClick={handleAddPayee} disabled={createPayeeMutation.isPending}>
                          {createPayeeMutation.isPending ? "Saving..." : "Save Payee"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 p-3 pt-0">
                <div className="space-y-1">
                  <Label className="text-xs">From Account</Label>
                  <Select value={fromAccountForPayee} onValueChange={setFromAccountForPayee}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select Source Account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts?.map((a: any) => (
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

                <div className="space-y-1">
                  <Label className="text-xs">Payee</Label>
                  <Select value={payeeId} onValueChange={setPayeeId}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select Payee" />
                    </SelectTrigger>
                    <SelectContent>
                      {savedPayees?.map((payee: any) => (
                        <SelectItem key={payee.id} value={payee.id.toString()}>
                          <div className="text-left">
                            <p className="font-medium">{payee.name}</p>
                            <p className="text-xs text-muted-foreground">{payee.bankName} - ****{payee.accountNumber?.slice(-4)}</p>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">$</span>
                    <Input 
                      type="number" 
                      value={payeeAmount}
                      onChange={e => setPayeeAmount(e.target.value)}
                      className="pl-6 h-9 text-sm font-bold"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <Button 
                  className="w-full h-9 text-sm shadow-lg shadow-primary/25" 
                  onClick={handleExternalPayment}
                  disabled={paymentMutation.isPending}
                >
                  {paymentMutation.isPending ? "Processing..." : "Schedule Payment"}
                </Button>

                {savedPayees && savedPayees.length > 0 && (
                  <div className="bg-muted/30 rounded-lg p-2 border border-border">
                    <h3 className="font-semibold mb-1.5 text-xs">Saved Payees</h3>
                    <div className="space-y-1">
                      {savedPayees.map((payee: any) => (
                        <div key={payee.id} className="flex items-center justify-between p-1.5 rounded-lg hover:bg-muted/50">
                          <div>
                            <p className="font-medium text-xs">{payee.name}</p>
                            <p className="text-[10px] text-muted-foreground">{payee.bankName} - ****{payee.accountNumber?.slice(-4)}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="text-primary hover:bg-primary/10"
                              onClick={() => setPayeeId(payee.id.toString())}
                            >
                              Select
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                if (window.confirm("Are you sure you want to delete this payee?")) {
                                  deletePayeeMutation.mutate(payee.id);
                                }
                              }}
                              disabled={deletePayeeMutation.isPending}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Account Management Section */}
            <Card className="border-none shadow-xl shadow-primary/5">
              <CardHeader className="p-3">
                <CardTitle className="text-sm">Account Management</CardTitle>
                <CardDescription className="text-xs">View details and manage your connected accounts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 p-3 pt-0">
                {accounts?.map((account: any) => (
                  <div key={account.id} className="p-2 rounded-lg border border-border/50 bg-accent/5 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          <Wallet className="w-3 h-3" />
                        </div>
                        <div>
                          <p className="font-bold text-xs">Account #{account.id}</p>
                          <p className="text-[10px] text-muted-foreground capitalize">{account.accountType}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="text-xs font-bold">${Number(account.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                          <p className="text-[7px] text-muted-foreground uppercase tracking-wider font-bold">Balance</p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10 text-xs"
                          onClick={() => {
                            if (window.confirm("Are you sure you want to delete this account? This action cannot be undone.")) {
                              deleteAccountMutation.mutate(account.id);
                            }
                          }}
                          disabled={deleteAccountMutation.isPending}
                        >
                          Close Account
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </LayoutShell>
  );
}
