"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/axios";
import { ChatList } from "@/components/ChatList";
import { ChatWindow } from "@/components/ChatWindow";
import { getSocket } from "@/lib/socket";
import { getChats } from "@/lib/chats";
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

  // один эффект: me + chats
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/auth/me");
        setMe(res.data);

        setLoadingChats(true);
        setChats(await getChats());
      } catch {
        router.replace("/login");
      } finally {
        setLoadingChats(false);
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