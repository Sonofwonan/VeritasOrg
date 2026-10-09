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

// Fee descriptions may start with a stored currency label, not an amount.
// Omit that label in pound views; keep symbols attached to actual numbers.
export function transactionDescription(text: string | null | undefined, currency: BalanceCurrency): string {
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
