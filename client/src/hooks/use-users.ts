import { useQuery } from "@tanstack/react-query";

export type UserOption = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  role: string | null;
};

export function useUsers() {
  return useQuery<UserOption[]>({
    queryKey: ["/api/users"],
  });
}
