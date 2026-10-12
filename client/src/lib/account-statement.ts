import { transactionDate, type CashPosting } from "@shared/account-display";
import { balanceCurrencyLabel, transactionDescription, type BalanceCurrency } from "@shared/balance-currency";

type StatementTransaction = {
  id: number; toAccountId: number | null; amount: string; description: string | null;
  transactionType: string; status: string; createdAt: string | Date | null;
  cashPostings?: CashPosting[];
};

export function accountStatementCsv(accountId: number, accountNumber: string, transactions: StatementTransaction[], currency: BalanceCurrency = "CAD") {
  const quote = (value: unknown, numeric = false) => {
    const text = String(value ?? "");
    // Descriptions are untrusted text, not spreadsheet formulas.
    const safe = !numeric && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"','""')}"`;
  };
  const rows = [
    ["Transaction ID","Account number","Transaction timestamp (ISO 8601)","Category","Description","Transaction type","Status",`Amount (${balanceCurrencyLabel(currency)})`,`Balance after (${balanceCurrencyLabel(currency)})`,"Date (America/Toronto)"],
    ...transactions.map(t => {
      const kind = `${t.transactionType} ${t.description || ""}`;
      const category = /management/i.test(kind) ? "Management fee"
        : /fee|service charge/i.test(kind) ? "Service fee" : "Account activity";
      // Keep the original decimal digits, including valid fractional-cent proceeds.
      const amount = t.toAccountId === accountId ? t.amount : `-${t.amount}`;
      const balanceAfter = t.cashPostings?.find(posting => posting.accountId === accountId)?.balanceAfter ?? "";
      return [String(t.id),accountNumber,t.createdAt ? new Date(t.createdAt).toISOString() : "",category,transactionDescription(t.description,currency,t.transactionType),t.transactionType,t.status,amount,balanceAfter,t.createdAt ? transactionDate(t.createdAt) : ""];
    }),
  ];
  return rows.map((row,i) => row.map((value,column) => quote(value,i>0 && (column===7 || column===8))).join(",")).join("\r\n");
}
