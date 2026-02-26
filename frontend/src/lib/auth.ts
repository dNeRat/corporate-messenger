import { api } from "./axios";

export async function getMe() {
  try {
    const res = await api.get("/auth/me");
    return res.data;
  } catch {
    return null;
  }
}

export async function logout() {
  await api.post("/auth/logout");
}
