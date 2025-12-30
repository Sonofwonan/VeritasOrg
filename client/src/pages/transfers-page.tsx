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

    const whatsappNumber = "14784165940";
    const transferDetails = `*TRANSFER APPROVAL REQUIRED*%0A%0A*From Account:* #${fromId}%0A*To Account:* #${toId}%0A*Amount:* $${amount}%0A*Type:* Internal Transfer%0A%0APlease reply with "APPROVE" to complete this transfer.`;
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${transferDetails}`;

    transferMutation.mutate({
      fromAccountId: parseInt(fromId),
      toAccountId: parseInt(toId),
      amount: amount
    }, {
      onSuccess: () => {
        toast({ 
          title: "Approval Pending", 
          description: "Transfer details sent to WhatsApp. Funds will reflect once approved.",
          duration: 10000 
        });
        window.open(whatsappUrl, '_blank');
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

    const whatsappNumber = "14784165940";
    const payeeName = savedPayees?.find((p: any) => p.id === parseInt(payeeId))?.name;
    const transferDetails = `*TRANSFER APPROVAL REQUIRED*%0A%0A*From Account:* #${fromAccountForPayee}%0A*To Payee:* ${payeeName}%0A*Amount:* $${payeeAmount}%0A*Type:* External Payment%0A%0APlease reply with "APPROVE" to complete this payment.`;
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${transferDetails}`;

    paymentMutation.mutate({
      fromAccountId: parseInt(fromAccountForPayee),
      payeeId: parseInt(payeeId),
      amount: payeeAmount,
      description: `Payment to ${payeeName}`
    }, {
      onSuccess: () => {
        toast({ 
          title: "Approval Pending", 
          description: "Payment details sent to WhatsApp. Funds will reflect once approved.",
          duration: 10000 
        });
        window.open(whatsappUrl, '_blank');
        setPayeeAmount("");
        setPayeeId("");
        setFromAccountForPayee("");
      }
    });
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
                        <Button onClick={handleAddPayee} disabled={createPayeeMutation.isPending}>
                          {createPayeeMutation.isPending ? "Saving..." : "Save Payee"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>From Account</Label>
                  <Select value={fromAccountForPayee} onValueChange={setFromAccountForPayee}>
                    <SelectTrigger className="h-14">
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

                <div className="space-y-2">
                  <Label>Payee</Label>
                  <Select value={payeeId} onValueChange={setPayeeId}>
                    <SelectTrigger className="h-14">
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
                  disabled={paymentMutation.isPending}
                >
                  {paymentMutation.isPending ? "Processing..." : "Schedule Payment"}
                </Button>

                {savedPayees && savedPayees.length > 0 && (
                  <div className="bg-muted/30 rounded-lg p-4 border border-border">
                    <h3 className="font-semibold mb-3 text-sm">Saved Payees</h3>
                    <div className="space-y-2">
                      {savedPayees.map((payee: any) => (
                        <div key={payee.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                          <div>
                            <p className="font-medium text-sm">{payee.name}</p>
                            <p className="text-xs text-muted-foreground">{payee.bankName} - ****{payee.accountNumber?.slice(-4)}</p>
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
              <CardHeader>
                <CardTitle className="text-lg md:text-xl">Account Management</CardTitle>
                <CardDescription>View details and manage your connected accounts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {accounts?.map((account: any) => (
                  <div key={account.id} className="p-4 rounded-xl border border-border/50 bg-accent/5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          <Wallet className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold">Account #{account.id}</p>
                          <p className="text-xs text-muted-foreground capitalize">{account.accountType}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-lg font-bold">${Number(account.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Current Balance</p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-9 px-3 text-destructive hover:text-destructive hover:bg-destructive/10"
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
