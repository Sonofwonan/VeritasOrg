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
                  const isPending = t.status === "pending" || t.status === "under_review";
                  const isApproved = t.status === "approved";
                  const isRejected = t.status === "rejected";

                  const statusLabel = isApproved ? "Approved" : isRejected ? "Rejected" : t.status === "under_review" ? "Under Review" : "Pending";
                  const statusDot = isApproved ? "bg-emerald-500" : isRejected ? "bg-rose-500" : "bg-amber-400 animate-pulse";
                  const cardBorder = isApproved
                    ? "border-emerald-200 dark:border-emerald-800/40"
                    : isRejected
                    ? "border-rose-200 dark:border-rose-800/40"
                    : "border-amber-200 dark:border-amber-800/30";
                  const statusTextColor = isApproved ? "text-emerald-700 dark:text-emerald-400" : isRejected ? "text-rose-700 dark:text-rose-400" : "text-amber-700 dark:text-amber-400";
                  const statusBg = isApproved ? "bg-emerald-50 dark:bg-emerald-900/10" : isRejected ? "bg-rose-50 dark:bg-rose-900/10" : "bg-amber-50 dark:bg-amber-900/10";

                  return (
                    <div key={t.id} className={`rounded-xl border ${cardBorder} overflow-hidden`} data-testid={`inst-transfer-${t.id}`}>
                      <div className={`${statusBg} px-4 py-2 flex items-center justify-between border-b ${cardBorder}`}>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${statusDot}`} />
                          <span className={`text-xs font-semibold uppercase tracking-wide ${statusTextColor}`}>{statusLabel}</span>
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
                              All accounts · {t.transferType === "in-kind" ? "In-Kind Transfer" : "Cash Transfer"} · CAD ${Number(t.partialAmount).toLocaleString("en-CA", { maximumFractionDigits: 0 })} total
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
                          {isApproved ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          ) : isRejected ? (
                            <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                          ) : (
                            <Clock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          )}
                        </div>

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
