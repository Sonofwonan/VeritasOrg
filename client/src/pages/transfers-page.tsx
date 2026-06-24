import { useAccounts, useTransfer, usePayees, useCreatePayee, useDeletePayee, usePayment, useDeleteAccount } from "@/hooks/use-finances";
import { LayoutShell } from "@/components/layout-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRight, ArrowRightLeft, Plus, Wallet, CheckCircle2, AlertCircle, Building2, Clock, XCircle } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { InstitutionalTransferModal } from "@/components/institutional-transfer-modal";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function TransfersPage() {
  const { data: accounts, isLoading: loadingAccounts } = useAccounts();
  const { data: savedPayees, isLoading: loadingPayees } = usePayees();
  const transferMutation = useTransfer();
  const createPayeeMutation = useCreatePayee();
  const deletePayeeMutation = useDeletePayee();
  const paymentMutation = usePayment();
  const deleteAccountMutation = useDeleteAccount();
  const { toast } = useToast();
  const { user } = useAuth();
  const [showInstTransferModal, setShowInstTransferModal] = useState(false);

  const { data: institutionalTransfersList = [] } = useQuery<any[]>({
    queryKey: ["/api/institutional-transfers"],
  });

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

  const [feedback, setFeedback] = useState<{title: string, message: string, type: 'success' | 'error'} | null>(null);

  const handleInternalTransfer = () => {
    if (!fromId || !toId || !amount) {
      setFeedback({ title: "Incomplete Form", message: "Please ensure all transfer fields are filled correctly.", type: 'error' });
      return;
    }

    if (fromId === toId) {
      setFeedback({ title: "Invalid Selection", message: "Source and destination accounts must be different.", type: 'error' });
      return;
    }

    const isFromChecking = accounts?.find(a => a.id === parseInt(fromId))?.accountType === "Checking Account";
    const isToChecking = accounts?.find(a => a.id === parseInt(toId))?.accountType === "Checking Account";

    transferMutation.mutate({
      fromAccountId: parseInt(fromId),
      toAccountId: parseInt(toId),
      amount: amount
    }, {
      onSuccess: () => {
        const isInvestmentFlow = !isFromChecking || !isToChecking;
        setFeedback({ 
          title: isInvestmentFlow ? "Investment Transfer Initiated" : "Transfer Initiated", 
          message: isInvestmentFlow 
            ? "Your request to move funds for investment purposes has been staged. These funds remain liquid and available for withdrawal or external transfer once the institutional verification period (15-30 mins) completes."
            : "Your internal transfer has been staged for processing. Please allow 15-30 minutes for institutional verification and final settlement.",
          type: 'success' 
        });
        setAmount("");
        setFromId("");
        setToId("");
      },
      onError: (err) => {
        setFeedback({ title: "Transfer Failed", message: err.message || "Institutional verification failed. Please contact support.", type: 'error' });
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
      setFeedback({ title: "Incomplete Form", message: "Please select a source account and payee before scheduling.", type: 'error' });
      return;
    }

    const selectedPayee = savedPayees?.find((p: any) => p.id.toString() === payeeId);
    const firstName = selectedPayee ? selectedPayee.name.split(' ')[0] : 'Payee';

    paymentMutation.mutate({
      fromAccountId: parseInt(fromAccountForPayee),
      payeeId: parseInt(payeeId),
      amount: payeeAmount,
      description: `Payment to ${firstName}`
    }, {
      onSuccess: () => {
        setFeedback({ 
          title: "Institutional Payment Scheduled", 
          message: `Your payment to ${firstName} for $${Number(payeeAmount).toLocaleString()} has been initiated. This transaction is currently PENDING and will undergo standard security screening before final posting.`,
          type: 'success' 
        });
        setPayeeAmount("");
        setPayeeId("");
        setFromAccountForPayee("");
      },
      onError: (err: any) => {
        setFeedback({ title: "Payment Failed", message: err.message || "An error occurred while scheduling your payment.", type: 'error' });
      }
    });
  };

  if (loadingAccounts || loadingPayees) {
    return (
      <LayoutShell>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </LayoutShell>
    );
  }

  return (
    <LayoutShell>
      <div className="max-w-4xl mx-auto">
        {/* Banking Feedback Modal */}
        <Dialog open={!!feedback} onOpenChange={(open) => !open && setFeedback(null)}>
          <DialogContent className="sm:max-w-md border-primary/20 bg-zinc-950 text-white">
            <DialogHeader className="flex flex-col items-center gap-4 py-4">
              {feedback?.type === 'success' ? (
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/50">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center border border-destructive/50">
                  <AlertCircle className="w-8 h-8 text-destructive" />
                </div>
              )}
              <DialogTitle className="text-xl font-bold text-center tracking-tight">
                {feedback?.title}
              </DialogTitle>
              <DialogDescription className="text-zinc-400 text-center whitespace-pre-wrap leading-relaxed">
                {feedback?.message}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="sm:justify-center border-t border-white/5 pt-6">
              <Button 
                onClick={() => setFeedback(null)} 
                className="w-full sm:w-32 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl h-11 transition-all"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="mb-3">
          <h2 className="text-xl font-bold font-display">Transfers & Payments</h2>
          <p className="text-muted-foreground text-xs">Move money between your accounts or send payments to external recipients.</p>
        </div>

        <Tabs defaultValue="internal" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="internal" className="gap-2">
              <ArrowRightLeft className="w-4 h-4" />
              Internal
            </TabsTrigger>
            <TabsTrigger value="external" className="gap-2">
              <ArrowRight className="w-4 h-4" />
              External
            </TabsTrigger>
            <TabsTrigger value="institutional" className="gap-2">
              <Building2 className="w-4 h-4" />
              Institution
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
              <CardHeader className="p-4 border-b border-border/40">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base font-display">
                      <ArrowRight className="w-4 h-4 text-primary" />
                      Wire Disbursement
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">Initiate a wire transfer to a registered beneficiary</CardDescription>
                  </div>
                  <Dialog open={isPayeeDialogOpen} onOpenChange={setIsPayeeDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2 text-xs">
                        <Plus className="w-3.5 h-3.5" />
                        Register Beneficiary
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle className="font-display">Register Beneficiary</DialogTitle>
                        <DialogDescription>
                          Add a verified external counterparty for wire disbursements
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid gap-2">
                          <Label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Beneficiary Name</Label>
                          <Input 
                            placeholder="Legal entity or individual name"
                            value={payeeName}
                            onChange={(e) => setPayeeName(e.target.value)}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Receiving Institution</Label>
                          <Input 
                            placeholder="e.g., Royal Bank of Canada"
                            value={payeeBankName}
                            onChange={(e) => setPayeeBankName(e.target.value)}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="grid gap-2">
                            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Account / IBAN</Label>
                            <Input 
                              placeholder="Account number"
                              type="password"
                              value={payeeAccountNumber}
                              onChange={(e) => setPayeeAccountNumber(e.target.value)}
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">SWIFT / BIC</Label>
                            <Input 
                              placeholder="e.g., ROYCCAT2"
                              value={payeeRoutingNumber}
                              onChange={(e) => setPayeeRoutingNumber(e.target.value)}
                            />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 leading-relaxed">
                          Beneficiary details are verified against FINTRAC records before the first disbursement. Typical verification takes 1–2 business days.
                        </p>
                      </div>
                      <DialogFooter>
                        <Button onClick={handleAddPayee} disabled={createPayeeMutation.isPending}>
                          {createPayeeMutation.isPending ? "Registering..." : "Register Beneficiary"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 p-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Debit Account</Label>
                    <Select value={fromAccountForPayee} onValueChange={setFromAccountForPayee}>
                      <SelectTrigger className="h-10 text-sm" data-testid="select-from-account">
                        <SelectValue placeholder="Select source account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts?.map((a: any) => (
                          <SelectItem key={a.id} value={a.id.toString()} data-testid={`select-item-account-${a.id}`}>
                            <div className="text-left">
                              <p className="font-medium">{a.accountType}</p>
                              <p className="text-xs text-muted-foreground">${Number(a.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Beneficiary</Label>
                    <Select value={payeeId} onValueChange={setPayeeId}>
                      <SelectTrigger className="h-10 text-sm" data-testid="select-payee">
                        <SelectValue placeholder="Select registered beneficiary" />
                      </SelectTrigger>
                      <SelectContent>
                        {savedPayees?.length === 0 && (
                          <SelectItem value="__none__" disabled>No beneficiaries registered</SelectItem>
                        )}
                        {savedPayees?.map((payee: any) => (
                          <SelectItem key={payee.id} value={payee.id.toString()} data-testid={`select-item-payee-${payee.id}`}>
                            <div className="text-left">
                              <p className="font-medium">{payee.name}</p>
                              <p className="text-xs text-muted-foreground">{payee.bankName} · ****{payee.accountNumber?.slice(-4)}</p>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Wire Amount (CAD)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">$</span>
                    <Input 
                      type="number" 
                      value={payeeAmount}
                      onChange={e => setPayeeAmount(e.target.value)}
                      className="pl-6 h-10 text-sm font-bold"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <Button 
                  className="w-full h-10 text-sm shadow-lg shadow-primary/20 font-semibold tracking-wide" 
                  onClick={handleExternalPayment}
                  disabled={paymentMutation.isPending}
                  data-testid="button-initiate-wire"
                >
                  {paymentMutation.isPending ? "Submitting..." : "Initiate Wire Disbursement"}
                </Button>

                {savedPayees && savedPayees.length > 0 && (
                  <div className="pt-2 border-t border-border/40">
                    <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-2">Registered Beneficiaries</p>
                    <div className="space-y-1.5">
                      {savedPayees.map((payee: any) => (
                        <div key={payee.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-border/40 bg-muted/20 hover:bg-muted/40 transition-colors">
                          <div>
                            <p className="font-medium text-sm">{payee.name}</p>
                            <p className="text-[10px] text-muted-foreground">{payee.bankName} · ****{payee.accountNumber?.slice(-4)}</p>
                          </div>
                          <div className="flex gap-1.5">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-7 px-2 text-xs text-primary hover:bg-primary/10"
                              onClick={() => {
                                setPayeeId(payee.id.toString());
                                toast({ title: "Beneficiary Selected", description: `${payee.name} set as wire recipient.` });
                              }}
                            >
                              Select
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                if (window.confirm("Remove this beneficiary from your registered list?")) {
                                  deletePayeeMutation.mutate(payee.id);
                                }
                              }}
                              disabled={deletePayeeMutation.isPending}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          {/* Institutional Transfer Tab */}
          <TabsContent value="institutional" className="mt-2 space-y-4">
            <Card className="border-none shadow-xl shadow-primary/5">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 font-display">
                      <Building2 className="w-5 h-5 text-primary" />
                      Transfer to Another Institution
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Move your portfolio in-kind or as cash to any registered Canadian investment dealer.
                    </CardDescription>
                  </div>
                  <Button onClick={() => setShowInstTransferModal(true)} className="gap-2 shrink-0" data-testid="button-new-institutional-transfer">
                    <Plus className="w-4 h-4" />
                    New Request
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-4 mb-8">
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-5 space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Cash Transfer</p>
                    <p className="text-2xl font-bold font-display">12–18 weeks</p>
                    <p className="text-sm text-muted-foreground">Securities liquidated, cash wired to receiving institution</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-5 space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">In-Kind Transfer</p>
                    <p className="text-2xl font-bold font-display">12 weeks</p>
                    <p className="text-sm text-muted-foreground">Securities re-registered as-is via CDS to receiving custodian</p>
                  </div>
                </div>
                {institutionalTransfersList.length === 0 ? (
                  <div className="text-center py-16 space-y-3">
                    <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto">
                      <Building2 className="w-7 h-7 text-muted-foreground" />
                    </div>
                    <p className="font-medium">No transfer requests yet</p>
                    <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                      Submit a request to move your investments to another institution. Admin review required.
                    </p>
                    <Button variant="outline" onClick={() => setShowInstTransferModal(true)}>
                      Start a Transfer Request
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {institutionalTransfersList.map((t: any) => {
                      const statusIcon = t.status === "approved"
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        : t.status === "rejected"
                        ? <XCircle className="w-4 h-4 text-rose-500" />
                        : <Clock className="w-4 h-4 text-amber-500" />;
                      const statusColor = t.status === "approved"
                        ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800/40"
                        : t.status === "rejected"
                        ? "bg-rose-50 border-rose-200 dark:bg-rose-900/10 dark:border-rose-800/40"
                        : "bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800/40";
                      return (
                        <div key={t.id} className={`rounded-xl border p-4 ${statusColor}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              {statusIcon}
                              <div>
                                <p className="font-semibold text-sm">{t.institutionName}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {t.accountType} · {t.transferType === "in-kind" ? "In-Kind" : "Cash"} · {t.transferScope === "full" ? "Full transfer" : `Partial — CAD $${Number(t.partialAmount).toLocaleString()}`}
                                </p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${t.status === "approved" ? "bg-emerald-100 text-emerald-700" : t.status === "rejected" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                                {t.status}
                              </span>
                              <p className="text-xs text-muted-foreground mt-1">{new Date(t.createdAt).toLocaleDateString("en-CA")}</p>
                            </div>
                          </div>
                          {t.status === "approved" && t.estimatedCompletionDate && (
                            <div className="mt-3 pt-3 border-t border-current/10 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400">
                              <Clock className="w-3.5 h-3.5" />
                              Estimated completion: <strong>{new Date(t.estimatedCompletionDate).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}</strong>
                            </div>
                          )}
                          {t.adminNotes && <p className="mt-2 text-xs text-muted-foreground italic">Note: {t.adminNotes}</p>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <InstitutionalTransferModal
        open={showInstTransferModal}
        onClose={() => setShowInstTransferModal(false)}
        accounts={accounts || []}
        userId={user?.id || 0}
      />
    </LayoutShell>
  );
}
