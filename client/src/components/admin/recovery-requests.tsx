import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { adminRecoveryRequestPath, type RecoveryRequest } from "@shared/client-settings";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AdminRecoveryRequests({ adminKey }: { adminKey: string }) {
  const [selected, setSelected] = useState<RecoveryRequest | null>(null);
  const [verified, setVerified] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  const request = async (path: string, body?: object) => {
    const response = await fetch(path, { method: body ? "POST" : "GET", headers: {
      "x-admin-key": adminKey, ...(body ? { "Content-Type": "application/json" } : {}),
    }, ...(body ? {body: JSON.stringify(body)} : {}), cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "The request could not be completed.");
    return result;
  };
  const requests = useQuery<RecoveryRequest[]>({
    queryKey: [adminRecoveryRequestPath], queryFn: () => request(adminRecoveryRequestPath),
    gcTime: 0, staleTime: 0, refetchInterval: 30000,
  });
  const review = useMutation({
    gcTime: 0,
    mutationFn: async (action: "issue" | "reject") =>
      request(`${adminRecoveryRequestPath}/${selected!.id}/${action}`, { identityVerified: verified }),
    onSuccess: result => {
      if (result.recoveryCodes) setCodes(result.recoveryCodes);
      else setSelected(null);
      review.reset();
      void requests.refetch();
    },
    onError: (e: Error) => setError(e.message),
  });
  const close = () => { setSelected(null); setVerified(false); setCodes(null); setError(""); review.reset(); };
  return (
    <Card className="border-slate-700 bg-slate-800/40">
      <CardHeader><CardTitle>Recovery-code requests</CardTitle>
        <p className="text-sm text-slate-300">Verify the client's identity before issuing codes. Never send them through public messages or ordinary email.</p>
      </CardHeader>
      <CardContent>
        {requests.isLoading ? <p role="status">Loading requests…</p> : requests.isError ? (
          <p role="alert">Requests could not be loaded. <Button variant="outline" onClick={() => void requests.refetch()}>Try again</Button></p>
        ) : !requests.data?.length ? <p>No recovery-code requests.</p> : (
          <div className="divide-y divide-slate-700">
            {requests.data.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4" data-testid={`recovery-request-${item.id}`}>
              <div><p className="font-medium">{item.name}</p>
                <p className="text-sm text-slate-300">{item.clientRef} · {new Date(item.createdAt).toLocaleDateString("en-GB")}</p>
              </div>
              {item.status === "pending" ? <Button onClick={() => { setSelected(item); setVerified(false); setError(""); }}>Review request</Button>
                : <span className="text-sm capitalize">{item.status}</span>}
            </div>)}
          </div>
        )}
        <Dialog open={selected !== null} onOpenChange={open => { if (!open && !review.isPending) close(); }}>
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md" onInteractOutside={event => { if (review.isPending) event.preventDefault(); }}>
            <DialogHeader><DialogTitle>{codes ? "One-time recovery codes" : "Review recovery-code request"}</DialogTitle>
              <DialogDescription>{selected?.name} · {selected?.clientRef}</DialogDescription>
            </DialogHeader>
            {codes ? <>
              <p className="text-sm">These codes are shown only once. Save them for secure delivery to the verified client. Old recovery codes have been replaced and the client's signed-in sessions have ended.</p>
              <div aria-label="One-time recovery codes" className="grid grid-cols-2 gap-2">
                {codes.map(code => <code key={code} className="break-all border border-border p-2 text-center text-sm">{code}</code>)}
              </div>
              <Button onClick={close}>Done</Button>
            </> : <>
              <p className="text-sm">Issuing codes replaces the old set and signs the client out of all devices. It does not disable their authenticator.</p>
              <div className="flex items-start gap-3">
                <Checkbox id="recovery-identity-verified" checked={verified} onCheckedChange={value => setVerified(value === true)} />
                <Label htmlFor="recovery-identity-verified">I have verified this client's identity through our approved process.</Label>
              </div>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <div className="flex flex-wrap gap-2">
                <Button disabled={!verified || review.isPending} onClick={() => { setError(""); review.mutate("issue"); }}>Issue recovery codes</Button>
                <Button variant="outline" disabled={review.isPending} onClick={() => { setError(""); review.mutate("reject"); }}>Decline request</Button>
                <Button variant="ghost" disabled={review.isPending} onClick={close}>Cancel</Button>
              </div>
            </>}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
