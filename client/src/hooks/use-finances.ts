import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertAccount } from "@shared/routes";

// ACCOUNTS
export function useAccounts() {
  return useQuery({
    queryKey: [api.accounts.list.path],
    queryFn: async () => {
      const res = await fetch(api.accounts.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch accounts");
      return api.accounts.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertAccount) => {
      const res = await fetch(api.accounts.create.path, {
        method: api.accounts.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create account");
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
      const res = await fetch(api.investments.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch investments");
      return api.investments.list.responses[200].parse(await res.json());
    },
  });
}

export function useBuyInvestment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { accountId: number; symbol: string; amount: string }) => {
      const res = await fetch(api.investments.buy.path, {
        method: api.investments.buy.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
         const error = await res.json();
         throw new Error(error.message || "Failed to buy investment");
      }
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
      const res = await fetch(api.investments.sell.path, {
        method: api.investments.sell.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to sell investment");
      }
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
      const res = await fetch(api.transactions.transfer.path, {
        method: api.transactions.transfer.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to transfer funds");
      }
      return api.transactions.transfer.responses[201].parse(await res.json());
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
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch quote");
      return api.market.quote.responses[200].parse(await res.json());
    },
    enabled: !!symbol,
    refetchInterval: 10000, // Real-time feel
  });
}
