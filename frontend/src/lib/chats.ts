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

export async function getChatById(chatId: number) {
  const res = await api.get(`/chats/${chatId}`);
  return res.data as Chat & {
    members: Array<{
      userId: number;
      role: string;
      joinedAt: string;
      user: any;
    }>;
  };
}

export async function updateChatTitle(chatId: number, title?: string) {
  const res = await api.patch(`/chats/${chatId}`, { title });
  return res.data;
}

export async function addChatMembers(chatId: number, memberIds: number[]) {
  const res = await api.post(`/chats/${chatId}/members`, { memberIds });
  return res.data as { added: number };
}

export async function removeChatMember(chatId: number, userId: number) {
  const res = await api.delete(`/chats/${chatId}/members/${userId}`);
  return res.data as { removed: boolean };
}

export async function setChatMemberRole(
  chatId: number,
  userId: number,
  role: "ADMIN" | "MEMBER",
) {
  const res = await api.patch(`/chats/${chatId}/members/${userId}/role`, { role });
  return res.data as { userId: number; role: string };
}

export async function getChatPins(chatId: number) {
  const res = await api.get(`/chats/${chatId}/pins`);
  return res.data as any[];
}

export async function pinChatMessage(chatId: number, messageId: number) {
  const res = await api.post(`/chats/${chatId}/pins/${messageId}`);
  return res.data;
}

export async function unpinChatMessage(chatId: number, messageId: number) {
  const res = await api.delete(`/chats/${chatId}/pins/${messageId}`);
  return res.data;
}
