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
    <div className="h-full overflow-auto border-r border-zinc-800 bg-zinc-950">
      {chats.map((chat) => {
        const active = chat.id === selectedChatId;
        const last = chat.messages?.[0]?.text ?? "";
        const badge = unread[chat.id]?.count ?? 0;

        return (
          <button
            key={chat.id}
            onClick={() => onSelect(chat.id)}
            className={[
              "w-full text-left p-3 border-b border-zinc-800 hover:bg-zinc-900",
              active ? "bg-zinc-900" : "",
            ].join(" ")}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold truncate">{chatTitle(chat)}</div>

              {badge > 0 && (
                <div className="min-w-6 h-6 px-2 rounded-full bg-emerald-500 text-zinc-950 text-xs flex items-center justify-center">
                  {badge}
                </div>
              )}
            </div>

            <div className="text-sm text-zinc-400 truncate">{last}</div>
          </button>
        );
      })}
    </div>
  );
}
