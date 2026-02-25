"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/axios";
import { ChatList } from "@/components/ChatList";
import { ChatWindow } from "@/components/ChatWindow";
import { getSocket } from "@/lib/socket";
import { createChat, getChats } from "@/lib/chats";
import type { Chat } from "@/lib/types";

export default function HomePage() {
  const router = useRouter();

  const [pendingFirstUnreadId, setPendingFirstUnreadId] = useState<number | null>(null);

  const [me, setMe] = useState<any>(null);
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);

  const [unread, setUnread] = useState<
    Record<number, { count: number; firstId: number }>
  >({});

  const [chats, setChats] = useState<Chat[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [memberIdsInput, setMemberIdsInput] = useState("");
  const [isGroup, setIsGroup] = useState(false);
  const [title, setTitle] = useState("");

  const firstUnreadId = pendingFirstUnreadId;

  const selectedChatIdRef = useRef<number | null>(null);
  useEffect(() => {
    selectedChatIdRef.current = selectedChatId;
  }, [selectedChatId]);

  function selectChat(chatId: number) {
  const firstId = unread[chatId]?.firstId ?? null;

  setPendingFirstUnreadId(firstId); // сохранили до сброса
  setSelectedChatId(chatId);

  setUnread((prev) => {
    const next = { ...prev };
    delete next[chatId];
    return next;
  });
  }

  async function refreshChats() {
    setLoadingChats(true);
    try {
      setChats(await getChats());
    } finally {
      setLoadingChats(false);
    }
  }

  async function handleCreateChat(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;

    const memberIds = memberIdsInput
      .split(/[,\s]+/)
      .map((v) => Number(v))
      .filter((v) => Number.isInteger(v) && v > 0);

    if (memberIds.length === 0) {
      setCreateError("Введите хотя бы один userId");
      return;
    }

    if (!isGroup && memberIds.length !== 1) {
      setCreateError("Для личного чата нужен ровно один userId");
      return;
    }

    setCreateError(null);
    setCreating(true);

    try {
      const res = await createChat({
        isGroup,
        memberIds,
        title: isGroup ? title.trim() || undefined : undefined,
      });

      await refreshChats();

      const newChatId = res.chat?.id ?? res.chatId ?? null;
      if (newChatId) {
        setSelectedChatId(newChatId);
      }

      setMemberIdsInput("");
      setTitle("");
      setIsGroup(false);
    } catch (err: any) {
      setCreateError(err?.response?.data?.message ?? "Не удалось создать чат");
    } finally {
      setCreating(false);
    }
  }

  // один эффект: me + chats
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/auth/me");
        setMe(res.data);

        await refreshChats();
      } catch {
        router.replace("/login");
      }
    })();
  }, [router]);

  // realtime: unread + preview + поднять чат наверх
  useEffect(() => {
    const socket = getSocket();

    const onNew = (p: any) => {
      const chatId = Number(p.chatId);
      const msgId = Number(p.id);
      if (!chatId || !msgId) return;

      if (Number(selectedChatIdRef.current) !== chatId) {
        setUnread((prev) => {
          const cur = prev[chatId];
          return {
            ...prev,
            [chatId]: cur
              ? { count: cur.count + 1, firstId: cur.firstId }
              : { count: 1, firstId: msgId },
          };
        });
      }

      setChats((prev) => {
        const next = [...prev];
        const idx = next.findIndex((c) => c.id === chatId);
        if (idx === -1) return prev;

        const chat = next[idx];
        const msgText = p.text ?? "";
        const createdAt = p.createdAt ?? new Date().toISOString();

        const updated: Chat = {
          ...chat,
          updatedAt: createdAt,
          messages: [{ id: msgId, text: msgText, createdAt }],
        };

        next.splice(idx, 1);
        next.unshift(updated);
        return next;
      });
    };

    socket.on("new_message", onNew);
    return () => socket.off("new_message", onNew);
  }, []);

  if (!me) return null;

  return (
    <div className="h-screen overflow-hidden grid grid-cols-[320px_1fr]">
      <aside className="h-full overflow-y-auto border-r">
        <form onSubmit={handleCreateChat} className="p-3 border-b space-y-2">
          <div className="font-semibold">Новый чат</div>

          <input
            className="w-full border rounded p-2 text-sm"
            placeholder="User IDs (например: 2 или 2,5,7)"
            value={memberIdsInput}
            onChange={(e) => setMemberIdsInput(e.target.value)}
          />

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isGroup}
              onChange={(e) => setIsGroup(e.target.checked)}
            />
            Групповой чат
          </label>

          {isGroup && (
            <input
              className="w-full border rounded p-2 text-sm"
              placeholder="Название группы (опционально)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          )}

          {createError && <div className="text-sm text-red-600">{createError}</div>}

          <button
            className="w-full bg-black text-white rounded px-3 py-2 text-sm disabled:opacity-60"
            disabled={creating}
          >
            {creating ? "Создаём..." : "Создать чат"}
          </button>
        </form>

        {loadingChats ? (
          <div className="p-4">Loading chats...</div>
        ) : (
          <ChatList
            chats={chats}
            selectedChatId={selectedChatId}
            onSelect={selectChat}
            unread={unread}
          />
        )}
      </aside>

      <main className="h-full min-h-0 overflow-hidden">
        {selectedChatId ? (
          <ChatWindow
            chatId={selectedChatId}
            me={me}
            firstUnreadId={firstUnreadId}
            onConsumedFirstUnread={() => setPendingFirstUnreadId(null)}
          />
        ) : (
          <div className="p-6 text-gray-600">Выбери чат слева</div>
        )}
      </main>
    </div>
  );
}
