import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type InsertUser } from "@shared/routes";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { securityPaths, type MfaChallenge } from "@shared/security";

export function useAuth() {
  const queryClient = useQueryClient();

  // Initial user check
  const userQuery = useQuery({
    queryKey: [api.auth.me.path],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", api.auth.me.path);
        return api.auth.me.responses[200].parse(await res.json());
      } catch (e) {
        if (e instanceof Error && e.message.startsWith("401")) {
          return null;
        }
        throw e;
      }
    },
    retry: false,
    staleTime: Infinity,
    // Staff may change presentation preferences while this client session is open.
    refetchOnWindowFocus: "always",
    refetchOnMount: "always",
  });

  const loginMutation = useMutation({
    gcTime: 0,
    mutationFn: async (credentials: z.infer<typeof api.auth.login.input>) => {
      const res = await apiRequest(api.auth.login.method, api.auth.login.path, credentials);
      if (res.status === 202) return await res.json() as MfaChallenge;
      return api.auth.login.responses[200].parse(await res.json());
    },
    onSuccess: (user) => {
      queryClient.setQueryData([api.auth.me.path], "mfaRequired" in user ? null : user);
    },
  });

  const verifyMfaMutation = useMutation({
    gcTime: 0,
    mutationFn: async ({ code }: { code: string }) => {
      const res = await apiRequest("POST", securityPaths.challenge, { code });
      return api.auth.me.responses[200].parse(await res.json());
    },
    onSuccess: user => queryClient.setQueryData([api.auth.me.path], user),
  });

  const registerMutation = useMutation({
    mutationFn: async (data: InsertUser) => {
      const res = await apiRequest(api.auth.register.method, api.auth.register.path, data);
      return api.auth.register.responses[201].parse(await res.json());
    },
    onSuccess: (user) => {
      queryClient.setQueryData([api.auth.me.path], user);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest(api.auth.logout.method, api.auth.logout.path);
    },
    onSuccess: () => {
      queryClient.setQueryData([api.auth.me.path], null);
      queryClient.clear();
    },
  });

  return {
    user: userQuery.data,
    isLoading: userQuery.isLoading,
    hasSessionError: userQuery.isError && userQuery.data === undefined,
    retrySession: () => { void userQuery.refetch(); },
    login: loginMutation,
    verifyMfa: verifyMfaMutation,
    register: registerMutation,
    logout: logoutMutation,
  };
}
