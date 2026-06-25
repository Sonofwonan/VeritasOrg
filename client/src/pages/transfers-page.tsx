import { useAccounts } from "@/hooks/use-finances";
import { LayoutShell } from "@/components/layout-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, CheckCircle2, Building2, Clock, XCircle } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { InstitutionalTransferModal } from "@/components/institutional-transfer-modal";

export default function TransfersPage() {
  const { data: accounts, isLoading: loadingAccounts } = useAccounts();
  const { user } = useAuth();
  const [showInstTransferModal, setShowInstTransferModal] = useState(false);

  const { data: institutionalTransfersList = [] } = useQuery<any[]>({
    queryKey: ["/api/institutional-transfers"],
    refetchInterval: 15000,
  });

  if (loadingAccounts) {
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
        <div className="mb-5">
          <h2 className="text-xl font-bold font-display">Portfolio Transfer</h2>
          <p className="text-muted-foreground text-xs">Move your entire portfolio to another registered Canadian investment institution.</p>
        </div>

        <Card className="border-none shadow-xl shadow-primary/5">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 font-display">
                  <Building2 className="w-5 h-5 text-primary" />
                  Transfer to Another Institution
                </CardTitle>
                <CardDescription className="mt-1">
                  Move your full portfolio in-kind or as cash to any registered Canadian investment dealer. All requests are subject to admin review.
                </CardDescription>
              </div>
              <Button onClick={() => setShowInstTransferModal(true)} className="gap-2 shrink-0" data-testid="button-new-institutional-transfer">
                <Plus className="w-4 h-4" />
                New Request
              </Button>
            </div>
          </CardHeader>
          <CardContent>
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
                  const stage = t.status === "pending" ? 0
                    : t.status === "under_review" ? 1
                    : (t.status === "liquidating" || t.status === "approved") ? 2
                    : t.status === "completed" ? 3
                    : -1; // rejected
                  const isRejected = t.status === "rejected";
                  const isCash = t.transferType === "cash";

                  const LABELS: Record<string, string> = { pending: "Pending", under_review: "Under Review", liquidating: "Liquidating", approved: "Liquidating", completed: "Completed", rejected: "Rejected" };
                  const statusDot = stage === 3 ? "bg-emerald-500" : isRejected ? "bg-rose-500" : stage === 2 ? "bg-orange-400 animate-pulse" : "bg-amber-400 animate-pulse";
                  const cardBorder = stage === 3
                    ? "border-emerald-200 dark:border-emerald-800/40"
                    : isRejected
                    ? "border-rose-200 dark:border-rose-800/40"
                    : stage === 2
                    ? "border-orange-200 dark:border-orange-800/30"
                    : "border-amber-200 dark:border-amber-800/30";
                  const statusTextColor = stage === 3 ? "text-emerald-700 dark:text-emerald-400" : isRejected ? "text-rose-700 dark:text-rose-400" : stage === 2 ? "text-orange-700 dark:text-orange-400" : "text-amber-700 dark:text-amber-400";
                  const statusBg = stage === 3 ? "bg-emerald-50 dark:bg-emerald-900/10" : isRejected ? "bg-rose-50 dark:bg-rose-900/10" : stage === 2 ? "bg-orange-50 dark:bg-orange-900/10" : "bg-amber-50 dark:bg-amber-900/10";

                  // 4-step progress: Submitted → Under Review → Liquidating/Processing → Completed
                  const steps = [
                    { label: "Submitted", done: stage >= 0 },
                    { label: "Under Review", done: stage >= 1 },
                    { label: isCash ? "Liquidating" : "Processing", done: stage >= 2 },
                    { label: "Completed", done: stage >= 3 },
                  ];
                  const stepColor = stage === 3 ? "bg-emerald-400" : stage === 2 ? "bg-orange-400" : "bg-amber-400";
                  const stepTextColor = stage === 3 ? "text-emerald-600 dark:text-emerald-400" : stage === 2 ? "text-orange-600 dark:text-orange-400" : "text-amber-600 dark:text-amber-400";

                  return (
                    <div key={t.id} className={`rounded-xl border ${cardBorder} overflow-hidden`} data-testid={`inst-transfer-${t.id}`}>
                      <div className={`${statusBg} px-4 py-2 flex items-center justify-between border-b ${cardBorder}`}>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${statusDot}`} />
                          <span className={`text-xs font-semibold uppercase tracking-wide ${statusTextColor}`}>{LABELS[t.status] ?? t.status}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">Submitted {new Date(t.createdAt).toLocaleDateString("en-CA")}</span>
                      </div>

                      <div className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm">{t.institutionName}</p>
                              <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">Full Portfolio</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              All accounts · {isCash ? "Cash Transfer" : "In-Kind Transfer"} · CAD ${Number(t.partialAmount).toLocaleString("en-CA", { maximumFractionDigits: 0 })} total
                            </p>
                            {t.portfolioSnapshot && (() => {
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
                          {stage === 3 ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          ) : isRejected ? (
                            <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                          ) : (
                            <Clock className={`w-4 h-4 shrink-0 mt-0.5 ${stage === 2 ? "text-orange-500" : "text-amber-500"}`} />
                          )}
                        </div>

                        {!isRejected && (
                          <div className="grid grid-cols-4 gap-1 pt-1">
                            {steps.map((step, i) => (
                              <div key={i} className="flex flex-col items-center gap-1">
                                <div className={`w-full h-1 rounded-full ${step.done ? stepColor : "bg-muted"}`} />
                                <span className={`text-[10px] font-medium text-center leading-tight ${step.done ? stepTextColor : "text-muted-foreground"}`}>{step.label}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {t.estimatedCompletionDate && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40">
                            <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Estimated Completion</p>
                              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">{new Date(t.estimatedCompletionDate).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}</p>
                            </div>
                          </div>
                        )}
                        {t.adminNotes && t.adminNotes.toLowerCase().includes("estimated completion date") === false && (
                          <div className="border-t border-border/40 pt-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Advisor Note</p>
                            <p className="text-xs text-foreground/70">{t.adminNotes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
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
