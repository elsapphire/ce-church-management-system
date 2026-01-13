import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type InsertAttendance } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useAttendanceList(serviceId: number) {
  return useQuery({
    queryKey: [api.attendance.list.path, serviceId],
    enabled: !!serviceId,
    queryFn: async () => {
      const params = new URLSearchParams({ serviceId: serviceId.toString() });
      const res = await fetch(`${api.attendance.list.path}?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch attendance list");
      return api.attendance.list.responses[200].parse(await res.json());
    },
  });
}

export function useAttendanceStats(serviceId?: number) {
  return useQuery({
    queryKey: [api.attendance.stats.path, serviceId],
    queryFn: async () => {
      let url = api.attendance.stats.path;
      if (serviceId) {
        url += `?${new URLSearchParams({ serviceId: serviceId.toString() })}`;
      }
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return api.attendance.stats.responses[200].parse(await res.json());
    },
  });
}

export function useMarkAttendance() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertAttendance) => {
      const res = await fetch(api.attendance.mark.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to mark attendance");
      }
      return api.attendance.mark.responses[201].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: [api.attendance.list.path, variables.serviceId] 
      });
      queryClient.invalidateQueries({
        queryKey: [api.attendance.stats.path]
      });
      toast({ title: "Success", description: "Attendance marked" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}
