import { api } from "./axios";

export async function getMessages(chatId: number, cursor?: number, take = 30) {
  const params = new URLSearchParams();
  params.set("take", String(take));
  if (cursor) params.set("cursor", String(cursor));

  const res = await api.get(`/chats/${chatId}/messages?` + params.toString());
  return res.data as { items: any[]; nextCursor: number | null };
}

export async function sendMessage(chatId: number, text: string) {
  const res = await api.post(`/chats/${chatId}/messages`, { text });
  return res.data;
}