import { useQuery } from "@tanstack/react-query";

const ACTIVE_STATUSES = ["liquidating", "approved", "transfer_out"];

export function useActiveLiquidation() {
  const { data: transfers = [] } = useQuery<any[]>({
    queryKey: ["/api/institutional-transfers"],
    refetchInterval: 15_000,
  });

  const activeTransfer = transfers.find(
    (t: any) => ACTIVE_STATUSES.includes(t.status)
  );

  return {
    isUnderLiquidation: !!activeTransfer,
    liquidationStatus: activeTransfer?.status ?? null,
    activeTransfer: activeTransfer ?? null,
  };
}
