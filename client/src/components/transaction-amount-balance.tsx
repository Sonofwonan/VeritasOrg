import { formatBalance, type BalanceCurrency } from "@shared/balance-currency";
import type { CashPosting } from "@shared/account-display";
import { cn } from "@/lib/utils";

export function TransactionAmountBalance({
  amount,
  currency,
  postings = [],
  amountClassName,
  showAccountNames = true,
}: {
  amount: string | number;
  currency: BalanceCurrency;
  postings?: CashPosting[];
  amountClassName?: string;
  showAccountNames?: boolean;
}) {
  return (
    <div className="min-w-0 max-w-full text-right">
      <p className={cn("whitespace-nowrap font-mono text-xs font-semibold tabular-nums sm:text-sm", amountClassName)}>
        {amount}
      </p>
      {postings.map(posting => (
        <p key={posting.accountId} data-balance-after={posting.accountId} className="mt-0.5 max-w-full whitespace-normal text-[11px] leading-tight text-muted-foreground [overflow-wrap:anywhere]">
          <span className="sr-only">Balance after transaction · {posting.accountName}: </span>
          {showAccountNames && <span>{posting.accountName} · </span>}
          <span className="whitespace-nowrap font-mono tabular-nums">{formatBalance(posting.balanceAfter, currency)}</span>
        </p>
      ))}
    </div>
  );
}
