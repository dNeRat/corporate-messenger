"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/axios";
import { ChatList } from "@/components/ChatList";
import { ChatWindow } from "@/components/ChatWindow";
import { getSocket } from "@/lib/socket";
import { createChat, getChats } from "@/lib/chats";
import { getMentions, getMentionsUnreadCount, markMentionRead } from "@/lib/messages";
import { logout } from "@/lib/auth";
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
  const [loggingOut, setLoggingOut] = useState(false);
  const [view, setView] = useState<"chats" | "mentions">("chats");
  const [mentions, setMentions] = useState<any[]>([]);
  const [mentionsCursor, setMentionsCursor] = useState<number | null>(null);
  const [loadingMentions, setLoadingMentions] = useState(false);
  const [mentionsUnreadCount, setMentionsUnreadCount] = useState(0);
  const [scrollToMessageId, setScrollToMessageId] = useState<number | null>(null);

  const firstUnreadId = pendingFirstUnreadId;

  const selectedChatIdRef = useRef<number | null>(null);
  useEffect(() => {
    selectedChatIdRef.current = selectedChatId;
  }, [selectedChatId]);

  function selectChat(chatId: number) {
    const firstId = unread[chatId]?.firstId ?? null;

    setPendingFirstUnreadId(firstId); // Сохранили до сброса
    setSelectedChatId(chatId);
    setScrollToMessageId(null);

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

  async function refreshMentions() {
    setLoadingMentions(true);
    try {
      const res = await getMentions(undefined, 30);
      setMentions(res.items);
      setMentionsCursor(res.nextCursor);
      const unread = await getMentionsUnreadCount();
      setMentionsUnreadCount(unread.count);
    } finally {
      setLoadingMentions(false);
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
        const unread = await getMentionsUnreadCount();
        setMentionsUnreadCount(unread.count);
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

    const onMention = (payload: any) => {
      setMentions((prev) => {
        if (prev.some((m) => m.id === payload.id)) return prev;
        return [payload, ...prev];
      });
      setMentionsUnreadCount((c) => c + 1);
    };

    socket.on("new_message", onNew);
    socket.on("mention_created", onMention);
    return () => {
      socket.off("new_message", onNew);
      socket.off("mention_created", onMention);
    };
  }, []);

  if (!me) return null;

  return (
    <div className="h-screen overflow-hidden grid grid-cols-[320px_1fr] bg-zinc-950 text-zinc-100">
      <aside className="h-full overflow-y-auto border-r border-zinc-800 bg-zinc-950">
        <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
          <div className="text-sm text-zinc-200 truncate">
            {me?.profile?.firstName || me?.email || "User"}
          </div>
          <button
            className="text-sm underline text-zinc-400 hover:text-zinc-200 disabled:opacity-60"
            disabled={loggingOut}
            onClick={async () => {
              if (loggingOut) return;
              setLoggingOut(true);
              try {
                await logout();
              } finally {
                setMe(null);
                setSelectedChatId(null);
                setUnread({});
                setChats([]);
                router.replace("/login");
              }
            }}
          >
            {loggingOut ? "Выходим..." : "Выйти"}
          </button>
        </div>

        <div className="p-2 border-b border-zinc-800 flex gap-2">
          <button
            className={[
              "flex-1 text-sm rounded px-2 py-1",
              view === "chats" ? "bg-emerald-500 text-zinc-950" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700",
            ].join(" ")}
            onClick={() => setView("chats")}
          >
            Чаты
          </button>
          <button
            className={[
              "flex-1 text-sm rounded px-2 py-1",
              view === "mentions" ? "bg-emerald-500 text-zinc-950" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700",
            ].join(" ")}
            onClick={() => {
              setView("mentions");
              if (mentions.length === 0) refreshMentions();
            }}
          >
            Упоминания{mentionsUnreadCount > 0 ? ` (${mentionsUnreadCount})` : ""}
          </button>
        </div>

        {view === "chats" && (
          <form onSubmit={handleCreateChat} className="p-3 border-b border-zinc-800 space-y-2">
          <div className="font-semibold">Новый чат</div>

          <input
            className="w-full border border-zinc-700 bg-zinc-900 rounded p-2 text-sm text-zinc-100 placeholder:text-zinc-500"
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
              className="w-full border border-zinc-700 bg-zinc-900 rounded p-2 text-sm text-zinc-100 placeholder:text-zinc-500"
              placeholder="Название группы (опционально)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          )}

          {createError && <div className="text-sm text-rose-400">{createError}</div>}

          <button
            className="w-full bg-emerald-500 text-zinc-950 rounded px-3 py-2 text-sm disabled:opacity-60"
            disabled={creating}
          >
            {creating ? "Создаём..." : "Создать чат"}
          </button>
        </form>
        )}

        {view === "chats" && (
          loadingChats ? (
            <div className="p-4 text-zinc-400">Loading chats...</div>
          ) : (
            <ChatList
              chats={chats}
              selectedChatId={selectedChatId}
              onSelect={selectChat}
              unread={unread}
            />
          )
        )}

        {view === "mentions" && (
          <div className="p-3 space-y-2">
            {loadingMentions && <div className="text-sm text-zinc-400">Загрузка...</div>}
            {!loadingMentions && mentions.length === 0 && (
              <div className="text-sm text-zinc-400">Нет упоминаний</div>
            )}
            {mentions.map((m: any) => {
              const msg = m.message;
              const chat = msg?.chat;
              const author =
                msg?.author?.profile?.firstName || msg?.author?.email || "Unknown";
              const chatTitle = chat?.isGroup
                ? chat?.title || `Chat #${chat?.id}`
                : `Chat #${chat?.id}`;
              return (
                <button
                  key={m.id}
                  className={[
                    "w-full text-left border border-zinc-800 rounded p-2 hover:bg-zinc-900",
                    m.readAt ? "" : "bg-amber-900/30",
                  ].join(" ")}
                  onClick={async () => {
                    setPendingFirstUnreadId(null);
                    setScrollToMessageId(msg?.id ?? null);
                    setSelectedChatId(chat?.id ?? null);
                    if (!m.readAt) {
                      try {
                        await markMentionRead(m.id);
                        setMentions((prev) =>
                          prev.map((x) => (x.id === m.id ? { ...x, readAt: new Date().toISOString() } : x)),
                        );
                        setMentionsUnreadCount((c) => Math.max(0, c - 1));
                      } catch {
                      }
                    }
                  }}
                >
                  <div className="text-xs text-zinc-500">{chatTitle}</div>
                  <div className="text-sm font-medium truncate">{author}</div>
                  <div className="text-sm text-zinc-300 truncate">
                    {msg?.deletedAt ? "Сообщение удалено" : msg?.text}
                  </div>
                </button>
              );
            })}

            {mentionsCursor && (
              <button
                className="text-sm underline text-zinc-400"
                onClick={async () => {
                  const res = await getMentions(mentionsCursor, 30);
                  setMentions((prev) => [...prev, ...res.items]);
                  setMentionsCursor(res.nextCursor);
                }}
              >
                Загрузить ещё
              </button>
            )}
          </div>
        )}
      </aside>

      <main className="h-full min-h-0 overflow-hidden bg-zinc-950">
        {selectedChatId ? (
          <ChatWindow
            chatId={selectedChatId}
            chat={chats.find((c) => c.id === selectedChatId) ?? null}
            me={me}
            firstUnreadId={firstUnreadId}
            scrollToMessageId={scrollToMessageId}
            onConsumedFirstUnread={() => setPendingFirstUnreadId(null)}
            onConsumedScrollToMessage={() => setScrollToMessageId(null)}
          />
        ) : (
          <div className="p-6 text-zinc-500">Выбери чат слева</div>
        )}
      </main>
    </div>
  );
}
