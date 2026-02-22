"use client";

import { useEffect, useState } from "react";
import type { Chat } from "@/lib/types";
import { getChats } from "@/lib/chats";

function chatTitle(chat: Chat) {
  if (chat.isGroup) return chat.title ?? `Group #${chat.id}`;
  const p = chat.companion?.profile;
  const name = [p?.firstName, p?.lastName].filter(Boolean).join(" ");
  return name || chat.companion?.email || `Chat #${chat.id}`;
}

export function ChatList({
  selectedChatId,
  onSelect,
}: {
  selectedChatId: number | null;
  onSelect: (chatId: number) => void;
}) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setChats(await getChats());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="p-4">Loading chats...</div>;

  return (
    <div className="h-full overflow-auto border-r">
      {chats.map((chat) => {
        const active = chat.id === selectedChatId;
        const last = chat.messages?.[0]?.text ?? "";
        return (
          <button
            key={chat.id}
            onClick={() => onSelect(chat.id)}
            className={[
              "w-full text-left p-3 border-b hover:bg-gray-50",
              active ? "bg-gray-100" : "",
            ].join(" ")}
          >
            <div className="font-semibold">{chatTitle(chat)}</div>
            <div className="text-sm text-gray-600 truncate">{last}</div>
          </button>
        );
      })}
    </div>
  );
}