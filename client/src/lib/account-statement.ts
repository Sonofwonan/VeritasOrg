import { transactionDate } from "@shared/account-display";
import { balanceCurrencyLabel, transactionDescription, type BalanceCurrency } from "@shared/balance-currency";

type StatementTransaction = {
  id: number; toAccountId: number | null; amount: string; description: string | null;
  transactionType: string; status: string; createdAt: string | Date | null;
};

export function accountStatementCsv(accountId: number, transactions: StatementTransaction[], currency: BalanceCurrency = "CAD") {
  const quote = (value: unknown, numeric = false) => {
    const text = String(value ?? "");
    // Descriptions are untrusted text, not spreadsheet formulas.
    const safe = !numeric && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"','""')}"`;
  };
  const rows = [
    ["Transaction ID","Recorded timestamp (ISO 8601)","Category","Description","Transaction type","Status",`Amount (${balanceCurrencyLabel(currency)})`,"Date (America/Toronto)"],
    ...transactions.map(t => {
      const kind = `${t.transactionType} ${t.description || ""}`;
      const category = /management/i.test(kind) ? "Management fee"
        : /fee|service charge/i.test(kind) ? "Service fee" : "Account activity";
      // Keep the original decimal digits, including valid fractional-cent proceeds.
      const amount = t.toAccountId === accountId ? t.amount : `-${t.amount}`;
      return [String(t.id),t.createdAt ? new Date(t.createdAt).toISOString() : "",category,transactionDescription(t.description,currency),t.transactionType,t.status,amount,t.createdAt ? transactionDate(t.createdAt) : ""];
    }),
  ];
  return rows.map((row,i) => row.map((value,column) => quote(value,i>0 && column===6)).join(",")).join("\r\n");
}
