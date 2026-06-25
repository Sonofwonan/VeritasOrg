import { useAccounts, usePayees, useCreatePayee, useDeletePayee, usePayment } from "@/hooks/use-finances";
import { LayoutShell } from "@/components/layout-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRight, Plus, CheckCircle2, AlertCircle, Building2, Clock, XCircle } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { InstitutionalTransferModal } from "@/components/institutional-transfer-modal";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function TransfersPage() {
  const { data: accounts, isLoading: loadingAccounts } = useAccounts();
  const { data: savedPayees, isLoading: loadingPayees } = usePayees();
  const createPayeeMutation = useCreatePayee();
  const deletePayeeMutation = useDeletePayee();
  const paymentMutation = usePayment();
  const { toast } = useToast();
  const { user } = useAuth();
  const [showInstTransferModal, setShowInstTransferModal] = useState(false);

  const { data: institutionalTransfersList = [] } = useQuery<any[]>({
    queryKey: ["/api/institutional-transfers"],
  });


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
          <p className="text-muted-foreground text-xs">Initiate wire disbursements or institutional account transfers.</p>
        </div>

        <Tabs defaultValue="external" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="external" className="gap-2">
              <ArrowRight className="w-4 h-4" />
              Wire Transfer
            </TabsTrigger>
            <TabsTrigger value="institutional" className="gap-2">
              <Building2 className="w-4 h-4" />
              Institution
            </TabsTrigger>
          </TabsList>

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
                        <SelectValue placeholder="Select approved beneficiary" />
                      </SelectTrigger>
                      <SelectContent>
                        {savedPayees?.filter((p: any) => p.status === "approved").length === 0 && (
                          <SelectItem value="__none__" disabled>No approved beneficiaries yet</SelectItem>
                        )}
                        {savedPayees?.filter((p: any) => p.status === "approved").map((payee: any) => (
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
                      {savedPayees.map((payee: any) => {
                        const isPending = !payee.status || payee.status === "pending_approval";
                        const isRejected = payee.status === "rejected";
                        const isApproved = payee.status === "approved";
                        return (
                          <div key={payee.id} className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors ${isPending ? "border-amber-200/60 bg-amber-50/40 dark:border-amber-800/30 dark:bg-amber-900/10" : isRejected ? "border-rose-200/60 bg-rose-50/40 dark:border-rose-800/30 dark:bg-rose-900/10" : "border-border/40 bg-muted/20 hover:bg-muted/40"}`}>
                            <div className="flex items-start gap-2.5 min-w-0">
                              <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${isPending ? "bg-amber-400 animate-pulse" : isRejected ? "bg-rose-400" : "bg-emerald-500"}`} />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium text-sm">{payee.name}</p>
                                  {isPending && <span className="text-[9px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">Pending Approval</span>}
                                  {isRejected && <span className="text-[9px] font-bold uppercase tracking-wide text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/30 px-1.5 py-0.5 rounded">Not Approved</span>}
                                  {isApproved && <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded">Verified</span>}
                                </div>
                                <p className="text-[10px] text-muted-foreground">{payee.bankName} · IBAN ****{payee.accountNumber?.slice(-4)} · SWIFT {payee.routingNumber || "—"}</p>
                                {isPending && <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">Under FINTRAC review · 1–2 business days</p>}
                              </div>
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                              {isApproved && (
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-primary hover:bg-primary/10"
                                  onClick={() => { setPayeeId(payee.id.toString()); toast({ title: "Beneficiary Selected", description: `${payee.name} set as wire recipient.` }); }}>
                                  Select
                                </Button>
                              )}
                              <Button variant="ghost" size="sm"
                                className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => { if (window.confirm("Remove this beneficiary?")) deletePayeeMutation.mutate(payee.id); }}
                                disabled={deletePayeeMutation.isPending}>
                                Remove
                              </Button>
                            </div>
                          </div>
                        );
                      })}
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
                {/* Live Transfer Status Monitor */}
                <div className="mb-2">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                    </span>
                    <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">Live Transfer Monitor</p>
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
                        const isPending = t.status === "pending" || t.status === "under_review";
                        const isApproved = t.status === "approved";
                        const isRejected = t.status === "rejected";

                        const statusLabel = isApproved ? "Approved" : isRejected ? "Rejected" : t.status === "under_review" ? "Under Review" : "Pending";
                        const statusDot = isApproved
                          ? "bg-emerald-500"
                          : isRejected
                          ? "bg-rose-500"
                          : "bg-amber-400 animate-pulse";
                        const cardBorder = isApproved
                          ? "border-emerald-200 dark:border-emerald-800/40"
                          : isRejected
                          ? "border-rose-200 dark:border-rose-800/40"
                          : "border-amber-200 dark:border-amber-800/30";
                        const statusTextColor = isApproved ? "text-emerald-700 dark:text-emerald-400" : isRejected ? "text-rose-700 dark:text-rose-400" : "text-amber-700 dark:text-amber-400";
                        const statusBg = isApproved ? "bg-emerald-50 dark:bg-emerald-900/10" : isRejected ? "bg-rose-50 dark:bg-rose-900/10" : "bg-amber-50 dark:bg-amber-900/10";

                        return (
                          <div key={t.id} className={`rounded-xl border ${cardBorder} overflow-hidden`} data-testid={`inst-transfer-${t.id}`}>
                            {/* Status bar */}
                            <div className={`${statusBg} px-4 py-2 flex items-center justify-between border-b ${cardBorder}`}>
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${statusDot}`} />
                                <span className={`text-xs font-semibold uppercase tracking-wide ${statusTextColor}`}>{statusLabel}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">Submitted {new Date(t.createdAt).toLocaleDateString("en-CA")}</span>
                            </div>

                            {/* Body */}
                            <div className="p-4 space-y-3">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-semibold text-sm">{t.institutionName}</p>
                                    {t.transferScope === "full-portfolio" && (
                                      <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">Full Portfolio</span>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {t.transferScope === "full-portfolio"
                                      ? <>All accounts · {t.transferType === "in-kind" ? "In-Kind Transfer" : "Cash Transfer"} · CAD ${Number(t.partialAmount).toLocaleString("en-CA", { maximumFractionDigits: 0 })} total</>
                                      : <>{t.accountType} · {t.transferType === "in-kind" ? "In-Kind Transfer" : "Cash Transfer"} · {t.transferScope === "full" ? "Full account" : `Partial — CAD $${Number(t.partialAmount).toLocaleString()}`}</>
                                    }
                                  </p>
                                  {t.transferScope === "full-portfolio" && t.portfolioSnapshot && (() => {
                                    try {
                                      const snap = JSON.parse(t.portfolioSnapshot);
                                      return (
                                        <p className="text-xs text-muted-foreground mt-1">
                                          {snap.length} accounts: {snap.map((a: any) => a.accountType).join(", ")}
                                        </p>
                                      );
                                    } catch { return null; }
                                  })()}
                                </div>
                                {isApproved ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                ) : isRejected ? (
                                  <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                ) : (
                                  <Clock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                )}
                              </div>

                              {/* Timeline row — only shown for active/approved */}
                              {!isRejected && (
                                <div className="grid grid-cols-3 gap-1 pt-1">
                                  {[
                                    { label: "Submitted", done: true },
                                    { label: "Under Review", done: isApproved },
                                    { label: "Completed", done: false },
                                  ].map((step, i) => (
                                    <div key={i} className="flex flex-col items-center gap-1">
                                      <div className={`w-full h-1 rounded-full ${step.done ? (isApproved ? "bg-emerald-400" : "bg-amber-400") : "bg-muted"}`} />
                                      <span className={`text-[10px] font-medium ${step.done ? (isApproved ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400") : "text-muted-foreground"}`}>{step.label}</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {isApproved && t.estimatedCompletionDate && (
                                <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                                  <Clock className="w-3 h-3" />
                                  Est. completion: <strong>{new Date(t.estimatedCompletionDate).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}</strong>
                                </p>
                              )}
                              {t.adminNotes && (
                                <p className="text-xs text-muted-foreground border-t border-border/40 pt-2 italic">Advisor note: {t.adminNotes}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
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
