"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/axios";
import { ChatList } from "@/components/ChatList";
import { ChatWindow } from "@/components/ChatWindow";
import { getSocket } from "@/lib/socket";
import { createDirectChat, createGroupChat, getChats } from "@/lib/chats";
import { getMentions, getMentionsUnreadCount, markMentionRead } from "@/lib/messages";
import { logout } from "@/lib/auth";
import { searchUsers } from "@/lib/users";
import type { Chat, User } from "@/lib/types";

export default function HomePage() {
  const router = useRouter();

  const [pendingFirstUnreadId, setPendingFirstUnreadId] = useState<number | null>(null);

  const [me, setMe] = useState<any>(null);
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
  const selectedChatIdRef = useRef<number | null>(null);

  const [unread, setUnread] = useState<Record<number, { count: number; firstId: number }>>({});
  const [chats, setChats] = useState<Chat[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);

  const [loggingOut, setLoggingOut] = useState(false);
  const [view, setView] = useState<"chats" | "mentions">("chats");

  const [mentions, setMentions] = useState<any[]>([]);
  const [mentionsCursor, setMentionsCursor] = useState<number | null>(null);
  const [loadingMentions, setLoadingMentions] = useState(false);
  const [mentionsUnreadCount, setMentionsUnreadCount] = useState(0);
  const [scrollToMessageId, setScrollToMessageId] = useState<number | null>(null);

  const [myPresence, setMyPresence] = useState<"ONLINE" | "DO_NOT_DISTURB">("ONLINE");

  const [createOpen, setCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState<"direct" | "group">("direct");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createTitle, setCreateTitle] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedDirectUserId, setSelectedDirectUserId] = useState<number | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);

  const firstUnreadId = pendingFirstUnreadId;

  useEffect(() => {
    selectedChatIdRef.current = selectedChatId;
  }, [selectedChatId]);

  function selectChat(chatId: number) {
    const firstId = unread[chatId]?.firstId ?? null;
    setPendingFirstUnreadId(firstId);
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
      const unreadRes = await getMentionsUnreadCount();
      setMentionsUnreadCount(unreadRes.count);
    } finally {
      setLoadingMentions(false);
    }
  }

  function userLabel(user: User | null | undefined) {
    if (!user) return "Unknown";
    const name = [user.profile?.firstName, user.profile?.lastName]
      .filter(Boolean)
      .join(" ");
    return name || user.email || `User #${user.id}`;
  }

  function resetCreateState(nextMode: "direct" | "group" = "direct") {
    setCreateMode(nextMode);
    setCreateError(null);
    setCreateTitle("");
    setUserQuery("");
    setUserResults([]);
    setSelectedDirectUserId(null);
    setSelectedGroupIds([]);
  }

  async function loadUsers(query?: string) {
    setLoadingUsers(true);
    try {
      setUserResults(await searchUsers(query, 30));
    } finally {
      setLoadingUsers(false);
    }
  }

  async function openCreateModal(mode: "direct" | "group" = "direct") {
    resetCreateState(mode);
    setCreateOpen(true);
    await loadUsers();
  }

  function closeCreateModal() {
    setCreateOpen(false);
    resetCreateState();
  }

  async function handleCreateDirect() {
    if (creating) return;
    if (!selectedDirectUserId) {
      setCreateError("Выберите пользователя");
      return;
    }

    setCreateError(null);
    setCreating(true);
    try {
      const res = await createDirectChat(selectedDirectUserId);
      await refreshChats();
      if (res.chatId) setSelectedChatId(res.chatId);
      closeCreateModal();
    } catch (err: any) {
      setCreateError(err?.response?.data?.message ?? "Не удалось создать личный чат");
    } finally {
      setCreating(false);
    }
  }

  async function handleCreateGroup() {
    if (creating) return;
    if (selectedGroupIds.length === 0) {
      setCreateError("Выберите хотя бы одного участника");
      return;
    }

    setCreateError(null);
    setCreating(true);
    try {
      const res = await createGroupChat({
        title: createTitle.trim() || undefined,
        memberIds: selectedGroupIds,
      });
      await refreshChats();
      const newChatId = res.chat?.id ?? res.chatId ?? null;
      if (newChatId) setSelectedChatId(newChatId);
      closeCreateModal();
    } catch (err: any) {
      setCreateError(err?.response?.data?.message ?? "Не удалось создать групповой чат");
    } finally {
      setCreating(false);
    }
  }

  function toggleGroupUser(userId: number) {
    setSelectedGroupIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  }

  const selectedGroupUsers = useMemo(
    () =>
      selectedGroupIds.map((id) => {
        const found = userResults.find((u) => Number(u.id) === id);
        if (found) return found;
        return { id, email: `User #${id}` } as User;
      }),
    [userResults, selectedGroupIds],
  );

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/auth/me");
        setMe(res.data);
        setMyPresence(
          res.data?.presenceStatus === "DO_NOT_DISTURB" ? "DO_NOT_DISTURB" : "ONLINE",
        );

        await refreshChats();
        const unreadRes = await getMentionsUnreadCount();
        setMentionsUnreadCount(unreadRes.count);
      } catch {
        router.replace("/login");
      }
    })();
  }, [router]);

  useEffect(() => {
    if (!createOpen) return;
    const timer = setTimeout(() => {
      loadUsers(userQuery).catch(() => {
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [createOpen, userQuery]);

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

    const onPresence = (payload: any) => {
      const userId = Number(payload?.userId);
      if (!userId) return;

      setMe((prev: any) => {
        if (!prev) return prev;
        const myId = Number(prev.id ?? prev.sub);
        if (myId !== userId) return prev;
        const nextStatus =
          payload.status === "DO_NOT_DISTURB" ? "DO_NOT_DISTURB" : "ONLINE";
        setMyPresence(nextStatus);
        return {
          ...prev,
          presenceStatus: payload.status,
          lastSeenAt: payload.lastSeenAt ?? null,
        };
      });

      setChats((prev) =>
        prev.map((chat) => {
          const next: any = { ...chat };

          if (next.companion && Number(next.companion.id) === userId) {
            next.companion = {
              ...next.companion,
              presenceStatus: payload.status,
              lastSeenAt: payload.lastSeenAt ?? null,
            };
          }

          if (Array.isArray(next.members)) {
            next.members = next.members.map((m: any) => {
              if (Number(m.userId ?? m.user?.id) !== userId) return m;
              return {
                ...m,
                user: {
                  ...m.user,
                  presenceStatus: payload.status,
                  lastSeenAt: payload.lastSeenAt ?? null,
                },
              };
            });
          }

          return next;
        }),
      );
    };

    socket.on("new_message", onNew);
    socket.on("mention_created", onMention);
    socket.on("presence_update", onPresence);
    return () => {
      socket.off("new_message", onNew);
      socket.off("mention_created", onMention);
      socket.off("presence_update", onPresence);
    };
  }, []);

  if (!me) return null;

  return (
    <div className="h-screen overflow-hidden grid grid-cols-[320px_1fr] bg-zinc-950 text-zinc-100">
      <aside className="h-full overflow-y-auto border-r border-zinc-800 bg-zinc-950">
        <div className="p-3 border-b border-zinc-800 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm text-zinc-200 truncate">
              {me?.profile?.firstName || me?.email || "User"}
            </div>
            <div className="text-xs text-zinc-500">
              {myPresence === "DO_NOT_DISTURB" ? "Не беспокоить" : "В сети"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="text-xs border border-zinc-700 bg-zinc-900 rounded px-2 py-1"
              value={myPresence}
              onChange={(e) => {
                const next =
                  e.target.value === "DO_NOT_DISTURB" ? "DO_NOT_DISTURB" : "ONLINE";
                setMyPresence(next);
                getSocket().emit("set_presence", { status: next });
              }}
            >
              <option value="ONLINE">В сети</option>
              <option value="DO_NOT_DISTURB">Не беспокоить</option>
            </select>
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
        </div>

        <div className="p-2 border-b border-zinc-800 flex gap-2">
          <button
            className={[
              "flex-1 text-sm rounded px-2 py-1",
              view === "chats"
                ? "bg-emerald-500 text-zinc-950"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700",
            ].join(" ")}
            onClick={() => setView("chats")}
          >
            Чаты
          </button>
          <button
            className={[
              "flex-1 text-sm rounded px-2 py-1",
              view === "mentions"
                ? "bg-emerald-500 text-zinc-950"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700",
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
          <div className="p-3 border-b border-zinc-800">
            <button
              className="w-full bg-emerald-500 text-zinc-950 rounded px-3 py-2 text-sm font-medium"
              onClick={() => {
                openCreateModal("direct").catch(() => {
                });
              }}
            >
              Новый чат
            </button>
          </div>
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
                          prev.map((x) =>
                            x.id === m.id ? { ...x, readAt: new Date().toISOString() } : x,
                          ),
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
                Загрузить еще
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

      {createOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div className="font-semibold">Новый чат</div>
              <button
                className="text-sm underline text-zinc-400 hover:text-zinc-200"
                onClick={closeCreateModal}
              >
                Закрыть
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex gap-2">
                <button
                  className={[
                    "flex-1 rounded px-2 py-1 text-sm",
                    createMode === "direct"
                      ? "bg-emerald-500 text-zinc-950"
                      : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700",
                  ].join(" ")}
                  onClick={() => {
                    setCreateMode("direct");
                    setCreateError(null);
                  }}
                >
                  Личный
                </button>
                <button
                  className={[
                    "flex-1 rounded px-2 py-1 text-sm",
                    createMode === "group"
                      ? "bg-emerald-500 text-zinc-950"
                      : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700",
                  ].join(" ")}
                  onClick={() => {
                    setCreateMode("group");
                    setCreateError(null);
                  }}
                >
                  Групповой
                </button>
              </div>

              {createMode === "group" && (
                <input
                  className="w-full border border-zinc-700 bg-zinc-950 rounded p-2 text-sm text-zinc-100 placeholder:text-zinc-500"
                  placeholder="Название группы (опционально)"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                />
              )}

              <input
                className="w-full border border-zinc-700 bg-zinc-950 rounded p-2 text-sm text-zinc-100 placeholder:text-zinc-500"
                placeholder="Поиск по имени или email"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
              />

              {createMode === "group" && selectedGroupUsers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedGroupUsers.map((user) => (
                    <button
                      key={user.id}
                      className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700"
                      onClick={() => toggleGroupUser(Number(user.id))}
                    >
                      {userLabel(user)} ×
                    </button>
                  ))}
                </div>
              )}

              <div className="max-h-64 overflow-auto border border-zinc-800 rounded">
                {loadingUsers && (
                  <div className="p-3 text-sm text-zinc-400">Загрузка...</div>
                )}
                {!loadingUsers && userResults.length === 0 && (
                  <div className="p-3 text-sm text-zinc-400">Пользователи не найдены</div>
                )}
                {!loadingUsers && userResults.map((user) => {
                  const isSelectedDirect = selectedDirectUserId === Number(user.id);
                  const isSelectedGroup = selectedGroupIds.includes(Number(user.id));
                  return (
                    <button
                      key={user.id}
                      className={[
                        "w-full text-left px-3 py-2 border-b border-zinc-800 last:border-b-0",
                        createMode === "direct"
                          ? isSelectedDirect
                            ? "bg-emerald-900/30"
                            : "hover:bg-zinc-800"
                          : isSelectedGroup
                            ? "bg-emerald-900/30"
                            : "hover:bg-zinc-800",
                      ].join(" ")}
                      onClick={() => {
                        if (createMode === "direct") {
                          setSelectedDirectUserId(Number(user.id));
                        } else {
                          toggleGroupUser(Number(user.id));
                        }
                      }}
                    >
                      <div className="text-sm font-medium">{userLabel(user)}</div>
                      <div className="text-xs text-zinc-400">{user.email}</div>
                    </button>
                  );
                })}
              </div>

              {createError && <div className="text-sm text-rose-400">{createError}</div>}
            </div>

            <div className="p-4 border-t border-zinc-800 flex justify-end gap-2">
              <button
                className="px-3 py-2 rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700 text-sm"
                onClick={closeCreateModal}
                disabled={creating}
              >
                Отмена
              </button>
              <button
                className="px-3 py-2 rounded bg-emerald-500 text-zinc-950 text-sm disabled:opacity-60"
                onClick={createMode === "direct" ? handleCreateDirect : handleCreateGroup}
                disabled={creating}
              >
                {creating
                  ? "Создаем..."
                  : createMode === "direct"
                    ? "Начать чат"
                    : "Создать группу"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
