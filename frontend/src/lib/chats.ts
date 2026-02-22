import { api } from "./axios";
import type { Chat } from "./types";

export async function getChats(): Promise<Chat[]> {
  const res = await api.get("/chats");
  return res.data;
}