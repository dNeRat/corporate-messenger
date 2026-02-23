"use client";

import type { Chat } from "@/lib/types";

function chatTitle(chat: Chat) {
  if (chat.isGroup) return chat.title ?? `Group #${chat.id}`;
  const p = chat.companion?.profile;
  const name = [p?.firstName, p?.lastName].filter(Boolean).join(" ");
  return name || chat.companion?.email || `Chat #${chat.id}`;
}

export function ChatList({
  chats,
  selectedChatId,
  onSelect,
  unread,
}: {
  chats: Chat[];
  selectedChatId: number | null;
  onSelect: (chatId: number) => void;
  unread: Record<number, { count: number; firstId: number }>;
}) {
  return (
    <div className="h-full overflow-auto border-r">
      {chats.map((chat) => {
        const active = chat.id === selectedChatId;
        const last = chat.messages?.[0]?.text ?? "";
        const badge = unread[chat.id]?.count ?? 0;

        return (
          <button
            key={chat.id}
            onClick={() => onSelect(chat.id)}
            className={[
              "w-full text-left p-3 border-b hover:bg-gray-50",
              active ? "bg-gray-100" : "",
            ].join(" ")}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold truncate">{chatTitle(chat)}</div>

              {badge > 0 && (
                <div className="min-w-6 h-6 px-2 rounded-full bg-black text-white text-xs flex items-center justify-center">
                  {badge}
                </div>
              )}
            </div>

            <div className="text-sm text-gray-600 truncate">{last}</div>
          </button>
        );
      })}
    </div>
  );
}