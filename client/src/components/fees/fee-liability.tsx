import { Link } from "wouter";
import { formatCAD, type ClientFeeSummary } from "@shared/fees";

export function FeeLiability({ summary, error, retry, hidden = false }: {
  summary?: ClientFeeSummary; error?: boolean; retry?: () => void; hidden?: boolean;
}) {
  if (error) return (
    <div role="alert" className="border border-red-300 bg-red-50 p-4 text-sm text-red-900">
      Service fees could not be loaded. Net balances are unavailable.
      <button onClick={retry} className="ml-2 underline">Retry</button>
    </div>
  );
  if (!summary || Number(summary.totalUnpaid) <= 0) return null;
  return (
    <section aria-label="Outstanding service fees" className="border border-red-300 bg-red-50 p-4 sm:p-5 text-red-950">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="label-caps text-red-800">Unpaid service fees · Amount owed</p>
          <p className="mt-1 break-all font-mono text-xl sm:text-2xl font-semibold" data-testid="text-unpaid-fees">
            {hidden ? "••••••" : formatCAD(summary.totalUnpaid)}
          </p>
        </div>
        <Link href="/accounts" className="text-sm underline underline-offset-4">Review accounts</Link>
      </div>
      <p className="mt-2 text-xs leading-relaxed">
        Included in net balances. Cash remains separate; this is unpaid service-fee debt, not an overdraft loan. No interest is added.
      </p>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {summary.accounts.filter(account => Number(account.unpaidTotal) > 0).map(account => (
          <Link key={account.accountId} href={`/accounts/${account.accountId}`} className="underline underline-offset-4">
            Account #{account.accountId}: {hidden ? "••••••" : formatCAD(account.unpaidTotal)} owed · {account.unpaidCount} unpaid fees
          </Link>
        ))}
      </div>
    </section>
  );
}

export function AccountFeeBalance({ cash, unpaid, hidden = false, dark = false }: {
  cash: string; unpaid?: string; hidden?: boolean; dark?: boolean;
}) {
  if (unpaid === undefined || Number(unpaid) <= 0) return null;
  const net = Number(cash) - Number(unpaid);
  const fmt = (value: number | string) => hidden ? "••••••" : formatCAD(value);
  return (
    <div className={`mt-2 border-t pt-2 ${dark ? "border-white/10 text-red-300" : "border-red-200 text-red-800"}`}>
      <p className="text-[10px] uppercase tracking-wide">Net account balance</p>
      <p className="break-all font-mono font-semibold" data-testid="text-net-account-balance">{fmt(net)}</p>
      <p className="mt-1 text-xs">{fmt(unpaid)} unpaid service fees</p>
    </div>
  );
}
