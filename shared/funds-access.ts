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
