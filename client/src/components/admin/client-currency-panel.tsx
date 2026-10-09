import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, RefreshCw, ShieldAlert } from "lucide-react";
import { accountLabel } from "@shared/account-display";
import { clientBalanceCurrency, formatBalance, type BalanceCurrency } from "@shared/balance-currency";
import type { ClientFeeSummary } from "@shared/fees";
import { AccountFeeBalance, FeeLiability } from "@/components/fees/fee-liability";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type ClientUser = {
  id: number;
  name: string;
  email?: string;
  displayCurrency?: string | null;
  totalBalance?: string | number;
};

type ClientAccount = {
  id: number;
  accountType: string;
  displayName?: string | null;
  balance?: string | number;
  unpaidFees?: string;
  unpaidTotal?: string;
  overdraft?: string;
};

async function readResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.message || `Request failed (${response.status})`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return data as T;
}

export function ClientCurrencyPanel({
  user,
  adminKey,
  open,
  onOpenChange,
}: {
  user: ClientUser | null;
  adminKey: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [currency, setCurrency] = useState<BalanceCurrency>("CAD");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshedDisplayCurrency, setRefreshedDisplayCurrency] = useState<BalanceCurrency | null>(null);
  const auditQuery = useQuery<Array<{
    id: number; actor: string; previousCurrency: BalanceCurrency; displayCurrency: BalanceCurrency;
    reason: string; createdAt: string;
  }>>({
    queryKey: ["/api/admin/users", user?.id, "display-currency", "audit"],
    enabled: open && !!user,
    staleTime: 0,
    queryFn: async () => readResponse(await fetch(`/api/admin/users/${user!.id}/display-currency/audit`, {
      headers: { "x-admin-key": adminKey },
    })),
  });

  useEffect(() => {
    if (open && user) {
      setCurrency(clientBalanceCurrency(user));
      setReason("");
      setConfirmed(false);
      setHidden(false);
      setSaveError("");
      setRefreshedDisplayCurrency(null);
    }
  }, [open, user?.id]);

  const accountsQuery = useQuery<ClientAccount[]>({
    queryKey: ["/api/admin/users", user?.id, "accounts"],
    enabled: open && !!user,
    staleTime: 0,
    queryFn: async () => {
      const response = await fetch(`/api/admin/users/${user!.id}/accounts`, {
        headers: { "x-admin-key": adminKey },
      });
      const result = await readResponse<ClientAccount[] | { accounts: ClientAccount[] }>(response);
      return Array.isArray(result) ? result : result.accounts;
    },
  });

  const feesQuery = useQuery<ClientFeeSummary>({
    queryKey: ["/api/admin/fees/clients", user?.id, "summary"],
    enabled: open && !!user,
    staleTime: 0,
    queryFn: async () => {
      const response = await fetch(`/api/admin/fees/clients/${user!.id}/summary`, {
        headers: { "x-admin-key": adminKey },
      });
      return readResponse<ClientFeeSummary>(response);
    },
    retry: false,
  });
  const feeSummary = feesQuery.isError ? undefined : feesQuery.data;
  const displayCurrency = refreshedDisplayCurrency || clientBalanceCurrency(user || undefined);

  const saveCurrency = async () => {
    if (!user || !confirmed || !reason.trim() || reason.trim().length > 500) return;
    setSaving(true);
    setSaveError("");
    try {
      const response = await fetch(`/api/admin/users/${user.id}/display-currency`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({
          displayCurrency: currency,
          expectedDisplayCurrency: refreshedDisplayCurrency || user.displayCurrency || "CAD",
          confirmed: true,
          reason: reason.trim(),
        }),
      });
      await readResponse<{ id: number; displayCurrency: BalanceCurrency }>(response);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/fees"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/user"] }),
      ]);
      onOpenChange(false);
    } catch (error) {
      const status = (error as Error & { status?: number }).status;
      setConfirmed(false);
      if (status === 409) {
        await queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
        const refreshedUsers = queryClient.getQueryData<ClientUser[]>(["/api/admin/users"]);
        const refreshedUser = refreshedUsers?.find(item => item.id === user.id);
        if (refreshedUser) {
          const latest = clientBalanceCurrency(refreshedUser);
          setRefreshedDisplayCurrency(latest);
          setCurrency(latest);
        }
        setSaveError("This preference changed elsewhere. The client list has been refreshed; close and reopen this panel before trying again.");
      } else {
        setSaveError(error instanceof Error ? error.message : "Could not save the display preference.");
      }
    } finally {
      setSaving(false);
    }
  };

  const money = (amount: string | number | undefined) =>
    amount === undefined || amount === null ? "Unavailable" : hidden ? "••••••" : formatBalance(amount, displayCurrency);

  return (
    <Dialog open={open} onOpenChange={value => { if (!saving) onOpenChange(value); }}>
      <DialogContent className="w-[calc(100%-2rem)] min-w-0 max-h-[90dvh] overflow-x-hidden overflow-y-auto border-slate-700 bg-slate-900 text-white sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Client display currency</DialogTitle>
          <DialogDescription className="break-words text-slate-400">
            {user?.name} {user?.email ? `· ${user.email}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border border-slate-700 bg-slate-800/50 p-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Current preference</p>
              <p className="mt-1 font-medium">{displayCurrency === "GBP" ? "£ Pound display" : "CAD display"}</p>
            </div>
            <Button type="button" variant="outline" size="sm" className="border-slate-600 text-slate-200" onClick={() => setHidden(value => !value)}>
              {hidden ? <Eye className="mr-2 h-4 w-4" /> : <EyeOff className="mr-2 h-4 w-4" />}
              {hidden ? "Show balances" : "Hide balances"}
            </Button>
          </div>

          <div className="border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">
            <p className="flex items-center gap-2 font-semibold"><ShieldAlert className="h-4 w-4 shrink-0" /> Presentation only — no conversion</p>
            <p className="mt-1 leading-relaxed text-amber-100/80">
              This changes how balances are displayed only. It does not convert amounts. Ledger amounts, historical records, pricing agreements, and the currency used for actual transfer settlement remain untouched.
            </p>
          </div>

          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium text-slate-200">Set client display preference</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {([{ value: "CAD", label: "CAD", detail: "Canadian dollar display" }, { value: "GBP", label: "£ Pound", detail: "Pound display" }] as const).map(option => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={currency === option.value}
                  disabled={saving}
                  onClick={() => { setCurrency(option.value); setConfirmed(false); }}
                  className={`border p-3 text-left transition-colors ${currency === option.value ? "border-primary bg-primary/10" : "border-slate-700 bg-slate-800/40 hover:border-slate-500"}`}
                >
                  <span className="block font-semibold">{option.label}</span>
                  <span className="mt-1 block text-xs text-slate-400">{option.detail}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <section className="space-y-3 border-t border-slate-700 pt-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Client accounts</h3>
                <p className="text-xs text-slate-400">Amounts use the current saved display preference; full digits are retained. Fee-plan prices remain in their recorded currency.</p>
              </div>
              {accountsQuery.isFetching && <RefreshCw className="h-4 w-4 animate-spin text-slate-400" aria-label="Loading accounts" />}
            </div>
            {accountsQuery.isError ? (
              <div role="alert" className="border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                Could not load this client’s accounts. {accountsQuery.error instanceof Error ? accountsQuery.error.message : ""}
                <Button type="button" variant="ghost" className="ml-1 h-auto p-0 text-red-200 underline" onClick={() => accountsQuery.refetch()}>Retry</Button>
              </div>
            ) : accountsQuery.isLoading ? (
              <div className="space-y-2" aria-label="Loading account balances">
                <div className="h-14 animate-pulse bg-slate-800" />
                <div className="h-14 animate-pulse bg-slate-800" />
              </div>
            ) : (
              <div className="space-y-2">
                {(accountsQuery.data || []).map(account => {
                  const fee = feeSummary?.accounts.find(item => item.accountId === account.id);
                  return (
                    <div key={account.id} className="border border-slate-700 bg-slate-800/30 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-slate-100">{accountLabel(account)}</p>
                          <p className="text-xs text-slate-500">{account.accountType}</p>
                        </div>
                        <p className="font-mono text-sm font-semibold tabular-nums">{money(account.balance)}</p>
                      </div>
                      {fee && account.balance !== undefined && (
                        <AccountFeeBalance
                          cash={String(account.balance)}
                          unpaid={fee.unpaidTotal}
                          overdraft={fee.overdraft}
                          hidden={hidden}
                          currency={displayCurrency}
                        />
                      )}
                    </div>
                  );
                })}
                {(accountsQuery.data || []).length === 0 && <p className="border border-slate-700 p-4 text-sm text-slate-400">No accounts are associated with this client.</p>}
              </div>
            )}
            {feesQuery.isLoading && <p className="text-xs text-slate-500">Checking fee liabilities…</p>}
            {(feeSummary || feesQuery.isError) && (
              <FeeLiability
                summary={feeSummary}
                hidden={hidden}
                currency={displayCurrency}
                accounts={accountsQuery.data}
                separateFromBalance
                 accountLinks={false}
                 error={feesQuery.isError}
                 retry={() => void feesQuery.refetch()}
              />
            )}
          </section>

          <div className="space-y-3 border-t border-slate-700 pt-4">
            <label htmlFor="display-currency-reason" className="block text-sm font-medium text-slate-200">Reason for change</label>
            <Textarea
              id="display-currency-reason"
              value={reason}
              maxLength={500}
              disabled={saving}
              onChange={event => setReason(event.target.value)}
              placeholder="Document why the display preference is being updated."
              className="min-h-20 border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
            />
            <p className="text-right text-xs text-slate-500">{reason.length}/500</p>
            <label className="flex items-start gap-2 text-sm text-slate-300">
              <Checkbox disabled={saving} checked={confirmed} onCheckedChange={value => setConfirmed(value === true)} className="mt-0.5 border-slate-500 data-[state=checked]:border-primary" />
              <span>I confirm this is a presentation preference only and does not change ledger or settlement currency.</span>
            </label>
          </div>

          {saveError && <p role="alert" className="border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{saveError}</p>}
          <section className="border-t border-slate-700 pt-4">
            <h3 className="text-sm font-semibold">Display preference history</h3>
            {auditQuery.isLoading ? <p className="text-sm text-slate-400">Loading history…</p>
              : auditQuery.isError ? <p role="alert" className="text-sm text-red-200">Could not load preference history. <button className="underline" onClick={() => void auditQuery.refetch()}>Retry</button></p>
              : !auditQuery.data?.length ? <p className="text-sm text-slate-400">No staff changes recorded.</p>
              : <ul className="mt-2 space-y-2 text-sm text-slate-300">{auditQuery.data.map(entry =>
                <li key={entry.id} className="border border-slate-700 p-2">
                  {entry.previousCurrency === "GBP" ? "£" : "CAD"} → {entry.displayCurrency === "GBP" ? "£" : "CAD"} · {entry.actor} · {new Date(entry.createdAt).toLocaleString()}
                  <p className="mt-1 break-words">{entry.reason}</p>
                  <p className="text-xs text-slate-500">Confirmed · Presentation only</p>
                </li>)}</ul>}
          </section>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" disabled={saving} variant="ghost" className="text-slate-300" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            type="button"
            disabled={!confirmed || !reason.trim() || reason.trim().length > 500 || saving || currency === displayCurrency}
            onClick={saveCurrency}
          >
            {saving && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
            Save display preference
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
