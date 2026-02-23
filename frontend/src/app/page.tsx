"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/axios";
import { ChatList } from "@/components/ChatList";
import { ChatWindow } from "@/components/ChatWindow";
import { getSocket } from "@/lib/socket";

export default function HomePage() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
  const [unread, setUnread] = useState<Record<number, number>>({});

  const selectedChatIdRef = useRef<number | null>(null);
  useEffect(() => {
    selectedChatIdRef.current = selectedChatId;
  }, [selectedChatId]);

  function selectChat(chatId: number) {
    setSelectedChatId(chatId);
    setUnread((prev) => {
      const next = { ...prev };
      delete next[chatId];
      return next;
    });
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/auth/me");
        setMe(res.data);
      } catch {
        router.replace("/login");
      }
    })();
  }, [router]);

  useEffect(() => {
    const socket = getSocket();

    const onNew = (p: any) => {
      const chatId = Number(p.chatId);
      if (!chatId) return;

      if (Number(selectedChatIdRef.current) !== chatId) {
        setUnread((prev) => ({ ...prev, [chatId]: (prev[chatId] ?? 0) + 1 }));
      }
    };

    socket.on("new_message", onNew);
    return () => {
      socket.off("new_message", onNew);
    };
  }, []);

  if (!me) return null;

  return (
    <div className="h-screen overflow-hidden grid grid-cols-[320px_1fr]">
      <aside className="h-full overflow-y-auto border-r">
        <ChatList selectedChatId={selectedChatId} onSelect={selectChat} unread={unread} />
      </aside>

      <main className="h-full min-h-0 overflow-hidden">
        {selectedChatId ? (
          <ChatWindow chatId={selectedChatId} me={me} />
        ) : (
          <div className="p-6 text-gray-600">Выбери чат слева</div>
        )}
      </main>
    </div>
  );
}