import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertAccount } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";

// ACCOUNTS
export function useAccounts() {
  return useQuery({
    queryKey: [api.accounts.list.path],
    queryFn: async () => {
      const res = await apiRequest("GET", api.accounts.list.path);
      return api.accounts.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertAccount) => {
      const res = await apiRequest(api.accounts.create.method, api.accounts.create.path, data);
      return api.accounts.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.accounts.list.path] });
    },
  });
}

// INVESTMENTS
export function useInvestments() {
  return useQuery({
    queryKey: [api.investments.list.path],
    queryFn: async () => {
      const res = await apiRequest("GET", api.investments.list.path);
      return api.investments.list.responses[200].parse(await res.json());
    },
  });
}

export function useBuyInvestment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { accountId: number; symbol: string; amount: string }) => {
      const res = await apiRequest(api.investments.buy.method, api.investments.buy.path, data);
      return api.investments.buy.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.investments.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.accounts.list.path] });
    },
  });
}

export function useSellInvestment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { accountId: number; symbol: string; shares: string }) => {
      const res = await apiRequest(api.investments.sell.method, api.investments.sell.path, data);
      return api.investments.sell.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.investments.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.accounts.list.path] });
    },
  });
}

// TRANSACTIONS
export function useTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { fromAccountId: number; toAccountId: number; amount: string }) => {
      const res = await apiRequest(api.transactions.transfer.method, api.transactions.transfer.path, data);
      return api.transactions.transfer.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.accounts.list.path] });
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", buildUrl(api.accounts.get.path, { id }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.accounts.list.path] });
    },
  });
}

// MARKET DATA
export function useMarketQuote(symbol: string) {
  return useQuery({
    queryKey: [api.market.quote.path, symbol],
    queryFn: async () => {
      const url = buildUrl(api.market.quote.path, { symbol });
      const res = await apiRequest("GET", url);
      return api.market.quote.responses[200].parse(await res.json());
    },
    enabled: !!symbol,
    refetchInterval: 10000, // Real-time feel
  });
}
