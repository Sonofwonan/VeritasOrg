import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import type { ClientFees, ClientFeeSummary, FeeOverview, FeePreview, FeeRunResult } from "@shared/fees";
import { useAuth } from "@/hooks/use-auth";

export function useClientFeeSummary() {
  const { user } = useAuth();
  const client = useQueryClient();
  const query = useQuery<ClientFeeSummary>({
    queryKey: ["/api/fees", "summary", user?.id],
    queryFn: async () => (await apiRequest("GET", "/api/fees/summary")).json(),
    enabled: !!user,
    refetchInterval: 30000,
  });
  useEffect(() => {
    if (query.data) void client.invalidateQueries({ queryKey: ["/api/accounts"], exact: true });
  }, [query.data, client]);
  return query;
}

export function useClientFees(accountId: number) {
  const client = useQueryClient();
  const query = useQuery<ClientFees>({
    queryKey: ["/api/fees", accountId],
    queryFn: async () => (await apiRequest("GET", `/api/accounts/${accountId}/fees`)).json(),
    enabled: Number.isInteger(accountId) && accountId > 0,
    refetchInterval: 30000,
  });
  useEffect(() => {
    if (!query.data?.assessments) return;
    // A production worker/admin can settle or refund while this client is viewing the account.
    // React Query structural sharing prevents unchanged polling responses triggering more fetches.
    void client.invalidateQueries({ queryKey: ["/api/accounts", accountId, "transactions"] });
    void client.invalidateQueries({ queryKey: ["/api/accounts"], exact: true });
  }, [query.data?.assessments, accountId, client]);
  return query;
}
export function useClientFeeAction(accountId: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ enrollmentId, action, scheduleId }: { enrollmentId: number; action: "accept" | "end"; scheduleId?: number }) =>
      (await apiRequest("POST", `/api/fees/enrollments/${enrollmentId}/${action}`,
        action === "accept" ? { scheduleId, accepted: true } : {})).json(),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["/api/fees", accountId] });
      client.invalidateQueries({ queryKey: ["/api/fees", "summary"] });
      client.invalidateQueries({ queryKey: ["/api/accounts"] });
    },
  });
}
async function feeAdminRequest<T>(key: string, path: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(`/api/admin/fees${path}`, {
    method, headers: { "Content-Type": "application/json", "x-admin-key": key },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Fee request failed");
  return data;
}
export function useAdminFees(adminKey: string) {
  return useQuery<FeeOverview>({
    queryKey: ["/api/admin/fees"],
    queryFn: () => feeAdminRequest(adminKey, ""),
    refetchInterval: 30000,
  });
}
export function useFeePreview(adminKey: string) {
  return useQuery<FeePreview>({
    queryKey: ["/api/admin/fees/preview"],
    queryFn: () => feeAdminRequest(adminKey, "/preview"),
    refetchInterval: 30000,
  });
}
// POST paths: /schedules, /offers, /settings, /run,
// /enrollments/:id/state, /assessments/:id/retry|waive|refund.
// Bodies: schedule {name,components,terms}; offer {accountId,scheduleId,firstChargeDate,servicesConfirmed:true};
// settings {enabled,confirmed:true}; state {state:'paused'|'active'|'ended'};
// run {confirmed:true,previewToken:string}; retry/waive/refund {confirmed:true,reason:string}.
export function useAdminFeeAction(adminKey: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ path, body }: { path: string; body: unknown }) => feeAdminRequest<FeeRunResult | unknown>(adminKey, path, "POST", body),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["/api/admin/fees"] });
      client.invalidateQueries({ queryKey: ["/api/admin/fees/preview"] });
      client.invalidateQueries({ queryKey: ["/api/admin/transactions"] });
      client.invalidateQueries({ queryKey: ["/api/admin/users"] });
      client.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      client.invalidateQueries({ queryKey: ["/api/accounts"] });
      client.invalidateQueries({ queryKey: ["/api/fees"] });
    },
  });
}
