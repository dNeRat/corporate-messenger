import { api } from "./axios";
import type { User } from "./types";

export async function searchUsers(query?: string, limit = 20): Promise<User[]> {
  const res = await api.get("/users/search", {
    params: {
      q: query?.trim() || undefined,
      limit,
    },
  });
  return res.data;
}
