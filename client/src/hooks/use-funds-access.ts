import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { apiRequest } from "@/lib/queryClient";
import type { FundsAccess } from "@shared/funds-access";

export function useFundsAccess() {
  const { user } = useAuth();
  const query = useQuery<FundsAccess>({
    queryKey: ["/api/funds-access", user?.id],
    queryFn: async () => (await apiRequest("GET", "/api/funds-access")).json(),
    enabled: Boolean(user?.debtClearanceRequired),
    refetchInterval: 15000,
  });
  return {
    ...query,
    requiresPayment: Boolean(user?.debtClearanceRequired || query.data?.requiresPayment),
    blocked: Boolean(query.data?.locked || (user?.debtClearanceRequired && (!query.data || query.isError))),
  };
}
