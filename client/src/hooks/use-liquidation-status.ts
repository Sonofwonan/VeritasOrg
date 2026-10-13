import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "./use-auth";

const ACTIVE_STATUSES = ["liquidating", "approved", "transfer_out"];

export function useActiveLiquidation() {
  const { user } = useAuth();
  const query = useQuery<any[]>({
    queryKey: ["/api/institutional-transfers"],
    queryFn: async () => {
      const data = await (await apiRequest("GET", "/api/institutional-transfers")).json();
      if (!Array.isArray(data) || data.some(t => !t || typeof t.status !== "string")) {
        throw new Error("Portfolio transfer status unavailable");
      }
      return data;
    },
    enabled: Boolean(user),
    refetchInterval: 15_000,
    retry: false,
  });

  // A failed refresh must not authorize writes using an older successful result.
  const statusUnavailable = query.isError || !query.data;
  const transfers = statusUnavailable ? [] : query.data!;
  const activeTransfer = transfers.find(
    (t: any) => ACTIVE_STATUSES.includes(t.status)
  );

  return {
    transfers,
    statusUnavailable,
    isError: query.isError,
    refetch: query.refetch,
    isUnderLiquidation: !!activeTransfer,
    liquidationStatus: activeTransfer?.status ?? null,
    activeTransfer: activeTransfer ?? null,
  };
}
