export interface FundsAccess {
  locked: boolean;
  requiresPayment: boolean;
  paymentRecorded: boolean;
  totalOwed: string;
  paymentAccountId: number | null;
  paymentAccountName: string | null;
}
