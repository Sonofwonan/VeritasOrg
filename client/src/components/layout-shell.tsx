import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useInactivityLogout } from "@/hooks/use-inactivity-logout";
import { useActiveLiquidation } from "@/hooks/use-liquidation-status";
import { useFundsAccess } from "@/hooks/use-funds-access";
import { fundsActionFeedback } from "@shared/funds-access";
import { LIQUIDATION_STATUS_UNAVAILABLE } from "@shared/liquidation";
import { FundsActionDialog } from "@/components/fees/funds-action-dialog";
import { ShieldAlert, Snowflake, AlertTriangle } from "lucide-react";
import { SlideOutNavigation } from "@/components/navigation/slide-out-navigation";
import { Button } from "@/components/ui/button";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useState, useEffect, useCallback, useRef } from "react";

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [topNavigationOpen, setTopNavigationOpen] = useState(false);
  const access = useFundsAccess();
  const { isUnderLiquidation, statusUnavailable, isError: liquidationError, refetch: refetchLiquidation } = useActiveLiquidation();
  const [fundsDialogOpen, setFundsDialogOpen] = useState(false);
  const fundsActionOrigin = useRef<HTMLElement | null>(null);
  const feedback = statusUnavailable
    ? { title: "Portfolio transfer status unavailable", message: LIQUIDATION_STATUS_UNAVAILABLE.message, retry: true }
    : fundsActionFeedback(access.blocked, access.data, access.isError);

  // Capture marked entry actions before navigation or any submit handler runs.
  const guardFundsAction = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element
      ? event.target.closest<HTMLElement>("[data-funds-action]") : null;
    if (!target || (!access.blocked && !statusUnavailable)) return;
    event.preventDefault();
    event.stopPropagation();
    fundsActionOrigin.current = target;
    setFundsDialogOpen(true);
  };

  const handleAutoLogout = useCallback(() => {
    logout.mutate();
  }, [logout]);

  const { showWarning, secondsLeft, dismiss } = useInactivityLogout(handleAutoLogout);

  useEffect(() => {
    setTopNavigationOpen(false);
  }, [location]);

  return (
    <>
      <div onClickCapture={guardFundsAction} className="flex h-screen w-full overflow-hidden bg-background">
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <SlideOutNavigation location={location} name={user?.name}
            open={sidebarOpen} onOpenChange={setSidebarOpen}
            detailsOpen={topNavigationOpen} onDetailsChange={setTopNavigationOpen}
            onNavigate={setLocation} onSignOut={() => logout.mutate()} signingOut={logout.isPending} />

          {(user as any)?.accountFrozen && (
            <div className="bg-sky-950 border-b border-sky-500/30 px-6 py-3 flex items-start gap-3">
              <Snowflake className="w-4 h-4 text-sky-400 mt-0.5 shrink-0 animate-pulse" />
              <div>
                <p className="text-sky-300 text-sm font-semibold">Account on hold</p>
                <p className="text-sky-400/70 text-xs mt-0.5">
                  Transfers and account changes are paused. Please contact your advisor at <span className="underline">veritaswealth@accountant.com</span> for help.
                </p>
              </div>
            </div>
          )}
          {statusUnavailable && (
            <div role="alert" data-testid="liquidation-status-unavailable" className="bg-muted border-b px-6 py-3 space-y-1">
              <p className="text-sm font-semibold">{liquidationError ? "Portfolio transfer status unavailable" : "Checking portfolio transfer status"}</p>
              <p className="text-sm text-muted-foreground">
                {liquidationError ? LIQUIDATION_STATUS_UNAVAILABLE.message : "Please wait before making transfers, trading or protected account changes."}
              </p>
              {liquidationError && <Button variant="outline" size="sm" onClick={() => void refetchLiquidation()}>Retry status check</Button>}
            </div>
          )}
          {isUnderLiquidation && !(user as any)?.accountFrozen && (
            <div className="bg-amber-950/60 border-b border-amber-500/30 px-6 py-3 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0 animate-pulse" />
              <div>
                <p className="text-amber-300 text-sm font-semibold">Portfolio transfer in progress</p>
                <p className="text-amber-400/70 text-xs mt-0.5">
                  Your portfolio transfer is in progress. Transfers, investing and account changes are paused until it is complete. Contact your advisor at{" "}
                  <span className="underline">veritaswealth@accountant.com</span> for updates.
                </p>
              </div>
            </div>
          )}
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-2 md:p-3 bg-muted/5 custom-scrollbar">
            <div className="max-w-7xl mx-auto space-y-2 md:space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {children}
            </div>
          </main>
        </div>
      </div>

      <FundsActionDialog open={fundsDialogOpen} onOpenChange={setFundsDialogOpen}
        title={feedback?.title ?? "Access updated"}
        message={feedback?.message ?? "Your access has changed. Close this message and try again."}
        retry={feedback?.retry ? () => void (statusUnavailable ? refetchLiquidation() : access.refetch()) : undefined}
        onCloseAutoFocus={event => {
          event.preventDefault();
          if (fundsActionOrigin.current?.isConnected) fundsActionOrigin.current.focus();
        }} />

      {/* Inactivity warning dialog */}
      <Dialog open={showWarning} onOpenChange={(open) => { if (!open) dismiss(); }}>
        <DialogContent className="sm:max-w-sm border-amber-500/30 bg-zinc-950 wealth-panel text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-400">
              <ShieldAlert className="w-5 h-5" />
              Session Expiring
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              For your security, you will be signed out due to inactivity.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center py-4 gap-2">
            <div className="text-6xl font-bold font-display text-white tabular-nums">
              {secondsLeft}
            </div>
            <p className="text-xs text-zinc-500 uppercase tracking-widest">seconds remaining</p>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" className="border-white/10 text-white hover:bg-white/5" onClick={() => logout.mutate()}>
              Sign out now
            </Button>
            <Button className="bg-primary hover:bg-primary/90" onClick={dismiss}>
              I'm still here
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
