import { api } from "./axios";
import type { Chat } from "./types";

export async function getChats(): Promise<Chat[]> {
  const res = await api.get("/chats");
  return res.data;
}

export async function createChat(payload: {
  isGroup: boolean;
  memberIds: number[];
  title?: string;
}) {
  const res = await api.post("/chats", payload);
  return res.data as { chat?: Chat; chatId?: number; reused?: boolean };
}
