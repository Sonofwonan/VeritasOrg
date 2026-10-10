import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FundsAccess } from "@shared/funds-access";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function DebtRestrictionPanel({ user, adminKey, onClose }: {
  user: { id: number; name: string } | null; adminKey: string; onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();
  const path = `/api/admin/users/${user?.id}/debt-restriction`;
  async function request(options: RequestInit = {}): Promise<FundsAccess> {
    const response = await fetch(path, { ...options,
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey } });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || "Restriction details unavailable");
    return body;
  }
  const status = useQuery({ queryKey: [path], queryFn: () => request(), enabled: !!user });
  const save = useMutation({
    mutationFn: (confirmed: boolean) => request({
      method: "POST", body: JSON.stringify({ confirmed, reason }),
    }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: [path] }); setReason(""); },
  });
  useEffect(() => { setReason(""); save.reset(); }, [user?.id]);
  return <Dialog open={!!user} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Debt restriction notice — {user?.name}</DialogTitle>
        <DialogDescription>
          Confirm the reason for an existing funds restriction. This does not change balances,
          record a payment or release funds.
          A payment, credit or fee reduction requires a fresh notice confirmation if funds remain restricted.
        </DialogDescription>
      </DialogHeader>
      {status.isLoading ? <p role="status">Loading restriction status…</p> :
        status.isError ? <p role="alert">Restriction details unavailable.
          <button onClick={() => void status.refetch()} className="ml-2 underline">Retry</button></p> :
        <p className="text-sm">{status.data?.locked
          ? status.data.debtRestrictionConfirmed ? "Debt restriction confirmed." : "Funds locked; admin debt reason not yet confirmed."
          : "No active debt restriction. No client notice is shown."}</p>}
      <label htmlFor="debt-notice-reason" className="text-sm">Reason for this notice decision</label>
      <Textarea id="debt-notice-reason" value={reason} onChange={e => setReason(e.target.value)}
        maxLength={500} placeholder="Document why the debt restriction notice should be shown or withdrawn." />
      {save.isError && <p role="alert" className="text-sm text-red-700">{save.error.message}</p>}
      <div className="flex flex-wrap gap-2">
        <Button disabled={save.isPending || status.isError || !status.data?.locked ||
          !status.data.paymentAccountId || reason.trim().length < 5}
          onClick={() => save.mutate(true)} data-testid="confirm-debt-notice">Confirm debt restriction</Button>
        <Button variant="outline" disabled={save.isPending || status.isError ||
          !status.data?.debtRestrictionConfirmed || reason.trim().length < 5}
          onClick={() => save.mutate(false)} data-testid="withdraw-debt-notice">Withdraw notice only</Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Verified payment and full debt clearance are still required by the existing access policy.
        Withdrawing the notice never unlocks funds.
      </p>
    </DialogContent>
  </Dialog>;
}
