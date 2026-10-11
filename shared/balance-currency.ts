import { formatCAD } from "./fees";

export type BalanceCurrency = "CAD" | "GBP";

// A presentation preference only: never converts or rewrites ledger amounts.
export function clientBalanceCurrency(user?: { displayCurrency?: string | null } | null): BalanceCurrency {
  if (!user?.displayCurrency || user.displayCurrency === "CAD") return "CAD";
  if (user.displayCurrency === "GBP") return "GBP";
  throw new Error("Unsupported balance display currency");
}

export function balanceCurrencyLabel(currency: BalanceCurrency): string {
  return currency === "GBP" ? "£" : "CAD";
}

// Nominal display only; original pricing/audit records remain unchanged.
export function balanceText(text: string | null | undefined, currency: BalanceCurrency): string {
  return currency === "GBP" ? (text || "").replace(/\b(?:CAD|GBP)\b/g, "£") : text || "";
}

// Clean only the known generated fee format, never arbitrary references or dates.
// This is presentation only: the original assessment/audit description stays stored.
export function transactionDescription(text: string | null | undefined, currency: BalanceCurrency, transactionType?: string): string {
  const generatedFee = (text || "").match(/^\s*(?:(?:CAD|GBP|£)\s+)?(monthly service fee|annual discretionary-management fee|annual management fee)( refund)?(?:\s*·\s*(?:\d{4}-\d{2}-\d{2}\s*·\s*)?Assessment \d+(?:\s*·\s*(?:Authorized fee overdraft|Available cash))?)?\s*$/i);
  if (generatedFee && (transactionType === undefined || transactionType === "fee" || transactionType === "fee_refund")) {
    const label = /^monthly/i.test(generatedFee[1]) ? "Monthly service fee" : "Annual management fee";
    return `${label}${generatedFee[2] ? " refund" : ""}`;
  }
  // Omit stray currency prefixes in pound views; retain actual monetary amounts.
  const presented = balanceText(text, currency);
  return currency === "GBP" ? presented.replace(/^\s*£\s*(?=[A-Za-z])/, "") : presented;
}

/** Read-only presentation copy; never pass this copy to a financial write. */
export function balancePresentation<T>(value: T, currency: BalanceCurrency): T {
  if (currency === "CAD") return value;
  if (typeof value === "string") return balanceText(value, currency) as T;
  if (Array.isArray(value)) return value.map(item => balancePresentation(item, currency)) as T;
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, balancePresentation(item, currency)])) as T;
  }
  return value;
}

export function formatBalance(amount: string | number, currency: BalanceCurrency = "CAD"): string {
  if (currency === "CAD") return formatCAD(amount);
  const value = Number(amount);
  if (!Number.isFinite(value)) return "Unavailable";
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP", minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(value);
}
