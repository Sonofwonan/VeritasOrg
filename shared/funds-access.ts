export interface FundsAccess {
  locked: boolean;
  requiresPayment: boolean;
  paymentRecorded: boolean;
  totalOwed: string;
  paymentAccountId: number | null;
  paymentAccountName: string | null;
  /** Explicit admin confirmation, never inferred from a ledger or generic freeze. */
  debtRestrictionConfirmed?: boolean;
}

export interface FundsActionFeedback {
  title: string;
  message: string;
  retry?: boolean;
}

/** Explain an existing lock, never infer a new restriction from account debt. */
export function fundsActionFeedback(
  blocked: boolean, data?: FundsAccess, error = false,
): FundsActionFeedback | null {
  if (!blocked) return null;
  if (error) return {
    title: "Please try again",
    message: "We couldn't check access to your funds. Please retry or contact your advisor.",
    retry: true,
  };
  if (!data) return {
    title: "Checking access",
    message: "Please wait while we check access to your funds, then try again.",
  };
  const owed = Number(data.totalOwed);
  if (!data.totalOwed?.trim() || !Number.isFinite(owed) || owed < 0) return {
    title: "Please try again",
    message: "We couldn't check access to your funds. Please retry or contact your advisor.",
    retry: true,
  };
  if (data.locked && data.requiresPayment && owed > 0) return {
    title: "Account debt",
    message: "Transfers and investing are blocked until your account debt is cleared. Please contact your advisor to arrange payment.",
  };
  if (data.locked && data.requiresPayment && !data.paymentRecorded) return {
    title: "Payment confirmation needed",
    message: "Transfers and investing are blocked until your payment is verified. Please contact your advisor for help.",
  };
  return {
    title: "Access restricted",
    message: "Transfers and investing are currently blocked. Please contact your advisor.",
  };
}
