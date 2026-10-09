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

export function formatBalance(amount: string | number, currency: BalanceCurrency = "CAD"): string {
  if (currency === "CAD") return formatCAD(amount);
  const value = Number(amount);
  if (!Number.isFinite(value)) return "Unavailable";
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP", minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(value);
}
