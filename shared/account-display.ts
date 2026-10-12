export function accountLabel(account: { accountType: string; displayName?: string | null }) {
  return account.displayName || account.accountType;
}

export type CashPosting = {
  accountId: number;
  accountName: string;
  accountNumber: string;
  balanceAfter: string;
};

export type TransactionWithCashPostings<T extends object = Record<string, unknown>> = T & {
  cashPostings?: CashPosting[];
};

export function maskAccountNumber(value?: string | null) {
  if (!value?.trim()) return "Account number unavailable";
  const normalized = value.trim();
  const suffix = normalized.replace(/\W/g, "").slice(-4);
  return suffix ? `•••• ${suffix}` : "••••";
}

// Statement dates are Toronto calendar dates, independent of the viewer's timezone.
export function transactionDate(value: string | Date, withTime = false) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto", year: "numeric", month: "long", day: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } as const : {}),
  }).format(new Date(value));
}
