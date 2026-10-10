import type { FundsAccess } from "@shared/funds-access";

export function DebtRestrictionStatus({ requiresPayment, data, error, retry }: {
  requiresPayment: boolean; data?: FundsAccess; error?: boolean; retry?: () => void;
}) {
  if (!requiresPayment) return null;
  // Failures or legacy policies lacking admin provenance do not establish a reason.
  if (error || !data || (data.locked && data.debtRestrictionConfirmed !== true)) {
    return <div role="status" data-testid="debt-restriction-unavailable"
      className="border border-border/60 px-4 py-3 text-xs text-muted-foreground">
      {error || !data ? "Funds access status unavailable." : "Restriction details unavailable."}
      {error && <button type="button" onClick={retry} className="ml-2 min-h-11 underline">Retry</button>}
    </div>;
  }
  if (!data.locked || !data.debtRestrictionConfirmed) return null;
  return <div role="status" data-testid="debt-restriction-status"
    className="flex items-center gap-3 border border-amber-300/60 bg-amber-50/60 px-4 py-3 text-sm text-foreground">
    Your administrator has restricted transfers and investing pending debt payment verification.
  </div>;
}
