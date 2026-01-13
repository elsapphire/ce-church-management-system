import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertMember } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useMembers(filters?: { search?: string; cellId?: number }) {
  const queryKey = [api.members.list.path, filters];
  return useQuery({
    queryKey,
    queryFn: async () => {
      const url = filters 
        ? `${api.members.list.path}?${new URLSearchParams(filters as any).toString()}`
        : api.members.list.path;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch members");
      return api.members.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateMember() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertMember) => {
      const res = await fetch(api.members.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create member");
      }
      return api.members.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.members.list.path] });
      toast({ title: "Success", description: "Member created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateMember() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Partial<InsertMember>) => {
      const url = buildUrl(api.members.update.path, { id });
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update member");
      return api.members.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.members.list.path] });
      toast({ title: "Success", description: "Member updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteMember() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.members.delete.path, { id });
      const res = await fetch(url, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete member");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.members.list.path] });
      toast({ title: "Success", description: "Member deleted" });
    },
  });
}
