import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type InsertUser } from "@shared/routes";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";

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
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: z.infer<typeof api.auth.login.input>) => {
      try {
        const res = await apiRequest(api.auth.login.method, api.auth.login.path, credentials);
        return api.auth.login.responses[200].parse(await res.json());
      } catch (e) {
        if (e instanceof Error && e.message.includes("502")) {
          throw new Error("The server is currently unreachable (502). This usually happens during a deployment or if the backend service is restarting on Render. Please try again in 30 seconds.");
        }
        throw e;
      }
    },
    onSuccess: (user) => {
      queryClient.setQueryData([api.auth.me.path], user);
    },
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
    login: loginMutation,
    register: registerMutation,
    logout: logoutMutation,
  };
}
