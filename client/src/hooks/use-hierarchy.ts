import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useHierarchy() {
  return useQuery({
    queryKey: [api.hierarchy.get.path],
    queryFn: async () => {
      const res = await fetch(api.hierarchy.get.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch hierarchy");
      return api.hierarchy.get.responses[200].parse(await res.json());
    },
  });
}
