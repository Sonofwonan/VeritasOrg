export function accountLabel(account: { accountType: string; displayName?: string | null }) {
  return account.displayName || account.accountType;
}

// Statement dates are Toronto calendar dates, independent of the viewer's timezone.
export function transactionDate(value: string | Date, withTime = false) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto", year: "numeric", month: "long", day: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } as const : {}),
  }).format(new Date(value));
}
