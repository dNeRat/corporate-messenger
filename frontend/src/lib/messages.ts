import { api } from "./axios";

export async function getMessages(chatId: number, cursor?: number, take = 30) {
  const params = new URLSearchParams();
  params.set("take", String(take));
  if (cursor) params.set("cursor", String(cursor));

  const res = await api.get(`/chats/${chatId}/messages?` + params.toString());
  return res.data as { items: any[]; nextCursor: number | null };
}

export async function sendMessage(chatId: number, text: string, replyToId?: number) {
  const res = await api.post(`/chats/${chatId}/messages`, { text, replyToId });
  return res.data;
}

export async function editMessage(chatId: number, messageId: number, text: string) {
  const res = await api.patch(`/chats/${chatId}/messages/${messageId}`, { text });
  return res.data;
}

export async function deleteMessage(chatId: number, messageId: number) {
  const res = await api.delete(`/chats/${chatId}/messages/${messageId}`);
  return res.data;
}
