"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { deleteMessage, editMessage, getMessages, sendMessage } from "@/lib/messages";
import { getSocket } from "@/lib/socket";
import { api } from "@/lib/axios";
import type { Chat } from "@/lib/types";
import {
  addChatMembers,
  getChatById,
  getChatPins,
  removeChatMember,
  pinChatMessage,
  setChatMemberRole,
  unpinChatMessage,
  updateChatTitle,
} from "@/lib/chats";

export function ChatWindow({
  chatId,
  chat,
  me,
  firstUnreadId,
  scrollToMessageId,
  onConsumedFirstUnread,
  onConsumedScrollToMessage,
}: {
  chatId: number;
  chat: Chat | null;
  me: any;
  firstUnreadId: number | null;
  scrollToMessageId: number | null;
  onConsumedFirstUnread: () => void;
  onConsumedScrollToMessage: () => void;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [typingUsers, setTypingUsers] = useState<Map<number, string>>(new Map());
  const typingTimerRef = useRef<any>(null);

  const [readMap, setReadMap] = useState<Record<number, string>>({});
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [details, setDetails] = useState<
    (Chat & { members?: any[] }) | null
  >(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [memberInput, setMemberInput] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [mutatingMember, setMutatingMember] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [pins, setPins] = useState<any[]>([]);
  const [pinsLoading, setPinsLoading] = useState(false);
  const [pinsOpen, setPinsOpen] = useState(true);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const itemsRef = useRef<any[]>([]);
  const nextCursorRef = useRef<number | null>(null);
  const initialLoadedRef = useRef(false);
  const onConsumedFirstUnreadRef = useRef(onConsumedFirstUnread);
  const suppressAutoScrollRef = useRef(false);
  const suppressAutoScrollUntilRef = useRef<number>(0);
  const chatIdRef = useRef(chatId);
  const jumpLockRef = useRef(false);

  const myId = Number(me?.sub ?? me?.id);

  // чтобы после consume firstUnread новые сообщения могли автоскроллиться
  const pendingFirstUnreadRef = useRef<number | null>(null);
  useEffect(() => {
    pendingFirstUnreadRef.current = firstUnreadId;
  }, [firstUnreadId]);

  function scrollToBottom(smooth = true) {
    bottomRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
    });
  }

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    nextCursorRef.current = nextCursor;
  }, [nextCursor]);

  useEffect(() => {
    initialLoadedRef.current = initialLoaded;
  }, [initialLoaded]);

  useEffect(() => {
    onConsumedFirstUnreadRef.current = onConsumedFirstUnread;
  }, [onConsumedFirstUnread]);

  useEffect(() => {
    chatIdRef.current = chatId;
  }, [chatId]);

  useEffect(() => {
    if (scrollToMessageId) {
      pendingFirstUnreadRef.current = null;
      suppressAutoScrollRef.current = true;
      suppressAutoScrollUntilRef.current = Date.now() + 2000;
    }
  }, [scrollToMessageId]);

  function canAutoScroll() {
    if (suppressAutoScrollRef.current) {
      if (Date.now() > suppressAutoScrollUntilRef.current) {
        suppressAutoScrollRef.current = false;
        return true;
      }
      return false;
    }
    return true;
  }

  useEffect(() => {
    let alive = true;
    const skipInitialAutoScroll = !!scrollToMessageId;

    if (scrollToMessageId) {
      suppressAutoScrollRef.current = true;
      suppressAutoScrollUntilRef.current = Date.now() + 2000;
    }
    setTypingUsers(new Map());
    setReadMap({});
    setItems([]);
    setNextCursor(null);
    setInitialLoaded(false);
    itemsRef.current = [];
    nextCursorRef.current = null;
    initialLoadedRef.current = false;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    setReplyTo(null);
    setEditingId(null);
    setEditText("");
    setPins([]);
    setMembers([]);

    (async () => {
      const page = await getMessages(chatId, undefined, 30);
      if (!alive) return;

      setItems(page.items.reverse());
      setNextCursor(page.nextCursor);
      setInitialLoaded(true);
      try {
        const rr = await api.get(`/chats/${chatId}/read`);
        const map: Record<number, string> = {};
        for (const row of rr.data) map[Number(row.userId)] = String(row.lastReadAt);
        setReadMap(map);
      } catch {}

      setTimeout(async () => {
        const pending = pendingFirstUnreadRef.current;
        if (pending) {
          const el = document.getElementById(`msg-${pending}`);
          if (el) {
            el.scrollIntoView({ behavior: "auto", block: "start" });
          } else {
            scrollToBottom(false);
          }
          // consume pending unread (важно!)
          pendingFirstUnreadRef.current = null;
          onConsumedFirstUnreadRef.current();
        } else if (!skipInitialAutoScroll && canAutoScroll()) {
          scrollToBottom(false);
        }
        try {
          await api.post(`/chats/${chatId}/read`);
          getSocket().emit("mark_read", { chatId });
        } catch {
        }
      }, 50);

      if (chat?.isGroup) {
        setPinsLoading(true);
        try {
          const nextPins = await getChatPins(chatId);
          setPins(nextPins);
          if (nextPins.length === 0) setPinsOpen(false);
        } catch {
        } finally {
          setPinsLoading(false);
        }
      }

      const baseMembers = chat?.members ?? [];
      if (baseMembers.length > 0) {
        setMembers(baseMembers);
      } else {
        try {
          const info = await getChatById(chatId);
          setMembers(info.members ?? []);
        } catch {
        }
      }
    })();

    const socket = getSocket();

    const onConnect = () => console.log("WS connected", socket.id);
    const onDisconnect = (r: any) => console.log("WS disconnected", r);
    const onConnectError = (e: any) => console.log("WS connect_error", e?.message || e);
    const onError = (e: any) => console.log("WS error event", e);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("error", onError);

    socket.emit("join_chat", { chatId }, (ack: any) => {
      console.log("join ack", ack);
    });

    const onNew = (payload: any) => {
      if (Number(payload.chatId) !== Number(chatId)) return;

      setItems((prev) => (prev.some((x) => x.id === payload.id) ? prev : [...prev, payload]));

      // автоскроллим вниз только если не висим на первом непрочитанном
      if (!pendingFirstUnreadRef.current && !skipInitialAutoScroll && canAutoScroll()) {
        setTimeout(() => scrollToBottom(true), 10);
      }
    };

    const onTyping = (p: any) => {
      if (Number(p.chatId) !== Number(chatId)) return;
      const uid = Number(p.userId);
      if (uid === myId) return;

      setTypingUsers((prev) => {
        const next = new Map(prev);
        next.set(uid, p.label || `User ${uid}`);
        return next;
      });
    };

    const onStopTyping = (p: any) => {
      if (Number(p.chatId) !== Number(chatId)) return;
      const uid = Number(p.userId);

      setTypingUsers((prev) => {
        const next = new Map(prev);
        next.delete(uid);
        return next;
      });
    };

    const onReadReceipt = (p: any) => {
      if (Number(p.chatId) !== Number(chatId)) return;
      const uid = Number(p.userId);
      if (!uid || !p.lastReadAt) return;
      setReadMap((prev) => ({ ...prev, [uid]: String(p.lastReadAt) }));
    };

    const onMessageUpdated = (payload: any) => {
      if (Number(payload.chatId) !== Number(chatId)) return;
      setItems((prev) =>
        prev.map((m) => (m.id === payload.id ? { ...m, ...payload } : m)),
      );
    };

    const onMessageDeleted = (payload: any) => {
      if (Number(payload.chatId) !== Number(chatId)) return;
      setItems((prev) =>
        prev.map((m) => (m.id === payload.id ? { ...m, ...payload } : m)),
      );
    };

    const onPresence = (payload: any) => {
      const userId = Number(payload?.userId);
      if (!userId) return;

      setMembers((prev) =>
        prev.map((m: any) => {
          if (Number(m.userId ?? m.user?.id) !== userId) return m;
          return {
            ...m,
            user: {
              ...m.user,
              presenceStatus: payload.status,
              lastSeenAt: payload.lastSeenAt ?? null,
            },
          };
        }),
      );

      setDetails((prev: any) => {
        if (!prev?.members) return prev;
        return {
          ...prev,
          members: prev.members.map((m: any) => {
            if (Number(m.userId ?? m.user?.id) !== userId) return m;
            return {
              ...m,
              user: {
                ...m.user,
                presenceStatus: payload.status,
                lastSeenAt: payload.lastSeenAt ?? null,
              },
            };
          }),
        };
      });
    };

    socket.on("new_message", onNew);
    socket.on("typing", onTyping);
    socket.on("stop_typing", onStopTyping);
    socket.on("read_receipt", onReadReceipt);
    socket.on("message_updated", onMessageUpdated);
    socket.on("message_deleted", onMessageDeleted);
    socket.on("presence_update", onPresence);

    return () => {
      alive = false;

      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);

      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("error", onError);

      socket.off("new_message", onNew);
      socket.off("typing", onTyping);
      socket.off("stop_typing", onStopTyping);
      socket.off("read_receipt", onReadReceipt);
      socket.off("message_updated", onMessageUpdated);
      socket.off("message_deleted", onMessageDeleted);
      socket.off("presence_update", onPresence);
    };
  }, [chatId, myId]);

  async function jumpToMessage(targetId: number) {
    const startChatId = chatId;
    suppressAutoScrollRef.current = true;
    suppressAutoScrollUntilRef.current = Date.now() + 2000;
    if (jumpLockRef.current) return;
    jumpLockRef.current = true;

    try {
      let wait = 0;
      while (!initialLoadedRef.current && wait < 50) {
        await new Promise((r) => setTimeout(r, 100));
        if (chatIdRef.current !== startChatId) return;
        wait += 1;
      }

      let currentItems = itemsRef.current;
      let cursor = nextCursorRef.current;

      if (!currentItems.some((m) => m.id === targetId)) {
        let safety = 0;
        while (cursor && safety < 50) {
          const page = await getMessages(startChatId, cursor, 30);
          if (chatIdRef.current !== startChatId) return;
          currentItems = [...page.items.reverse(), ...currentItems];
          cursor = page.nextCursor;
          if (currentItems.some((m) => m.id === targetId)) break;
          safety += 1;
        }
      }

      if (chatIdRef.current !== startChatId) return;

      if (currentItems !== itemsRef.current) {
        setItems(currentItems);
        setNextCursor(cursor ?? null);
      }

      setTimeout(() => {
        if (chatIdRef.current !== startChatId) return;
        const el = document.getElementById(`msg-${targetId}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
    } finally {
      jumpLockRef.current = false;
    }
  }

  useEffect(() => {
    if (!scrollToMessageId) return;
    jumpToMessage(scrollToMessageId).finally(() => onConsumedScrollToMessage());
  }, [scrollToMessageId, chatId, onConsumedScrollToMessage]);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    const t = (editingId ? editText : text).trim();
    if (!t) return;

    if (editingId) {
      const updated = await editMessage(chatId, editingId, t);
      setItems((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      setEditingId(null);
      setEditText("");
    } else {
      setText("");

      const msg = await sendMessage(chatId, t, replyTo?.id);

      // fallback, если WS задержится
      setItems((prev) => (prev.some((x) => x.id === msg.id) ? prev : [...prev, msg]));
      setReplyTo(null);
    }

    getSocket().emit("stop_typing", { chatId });

    // после своего сообщения — вниз
    setTimeout(() => scrollToBottom(true), 10);
  }

  async function loadMore() {
    if (!nextCursor) return;
    const page = await getMessages(chatId, nextCursor, 30);
    setNextCursor(page.nextCursor);
    setItems((prev) => [...page.items.reverse(), ...prev]);
  }

  function isReadBySomeoneElse(messageCreatedAt: string) {
    const msgTs = new Date(messageCreatedAt).getTime();
    return Object.entries(readMap).some(([uid, ts]) => {
      const id = Number(uid);
      if (id === myId) return false;
      return new Date(ts).getTime() >= msgTs;
    });
  }

  const headerTitle = (() => {
    if (!chat) return `Chat #${chatId}`;
    if (chat.isGroup) {
      return chat.title?.trim() || "Группа";
    }
    const p = chat.companion?.profile;
    const name = [p?.firstName, p?.lastName].filter(Boolean).join(" ");
    return name || chat.companion?.email || `Chat #${chatId}`;
  })();

  function formatLastSeen(lastSeenAt?: string | Date | null) {
    if (!lastSeenAt) return "Не в сети";

    const seen = new Date(lastSeenAt);
    if (Number.isNaN(seen.getTime())) return "Не в сети";

    const now = new Date();
    const isToday =
      seen.getFullYear() === now.getFullYear() &&
      seen.getMonth() === now.getMonth() &&
      seen.getDate() === now.getDate();
    const time = seen.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (isToday) return `Последний раз был(а) в ${time}`;

    const withYear = seen.getFullYear() !== now.getFullYear();
    const date = seen.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      ...(withYear ? { year: "numeric" } : {}),
    });
    return `Последний раз был(а) в ${time} ${date}`;
  }

  const directPresenceLabel =
    chat?.isGroup || !chat?.companion
      ? null
      : getPresenceLabel(chat.companion, true);

  const pinnedIds = new Set(pins.map((p) => Number(p.messageId)));

  function getMemberLabelById(userId: number) {
    const m = members.find((x) => Number(x.userId ?? x.id) === Number(userId));
    const p = m?.user?.profile || m?.profile || {};
    const name = [p?.firstName, p?.lastName].filter(Boolean).join(" ");
    return name || m?.user?.email || m?.email || `User ${userId}`;
  }

  function getPresenceLabel(user: any, showLastSeen = false) {
    if (user?.presenceStatus === "ONLINE") return "В сети";
    if (user?.presenceStatus === "DO_NOT_DISTURB") return "Не беспокоить";
    if (showLastSeen) return formatLastSeen(user?.lastSeenAt);
    return "Не в сети";
  }

  function renderMessageText(textValue: string) {
    if (!textValue) return textValue;

    const re = /@(\d+)/g;
    const nodes: Array<string | ReactNode> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = re.exec(textValue)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      const id = Number(match[1]);

      nodes.push(textValue.slice(lastIndex, start));
      const label = `@${getMemberLabelById(id)}`;
      const isMe = Number(id) === Number(myId);
      nodes.push(
        <span
          key={`${start}-${end}`}
          className={isMe ? "bg-amber-300 text-zinc-900 px-1 rounded" : "text-emerald-300"}
        >
          {label}
        </span>,
      );
      lastIndex = end;
    }

    nodes.push(textValue.slice(lastIndex));
    return nodes.length === 1 ? textValue : nodes;
  }

  const mentionCandidates = members.filter((m) => {
    const id = Number(m.userId ?? m.id);
    if (!mentionQuery) return true;
    const p = m.user?.profile || m.profile || {};
    const name = [p?.firstName, p?.lastName].filter(Boolean).join(" ").toLowerCase();
    const email = String(m.user?.email ?? m.email ?? "").toLowerCase();
    const q = mentionQuery.toLowerCase();
    return name.includes(q) || email.includes(q);
  });

  function onChangeTextValue(value: string, cursorPos: number | null) {
    const cursor = cursorPos ?? value.length;
    const before = value.slice(0, cursor);
    const at = before.lastIndexOf("@");

    if (
      at >= 0 &&
      (at === 0 || /\s/.test(before[at - 1])) &&
      !/\s/.test(before.slice(at + 1))
    ) {
      const query = before.slice(at + 1);
      setMentionOpen(true);
      setMentionQuery(query);
      setMentionStart(at);
      setMentionIndex(0);
    } else {
      setMentionOpen(false);
      setMentionQuery("");
      setMentionStart(null);
      setMentionIndex(0);
    }
  }

  function applyMention(userId: number) {
    const input = inputRef.current;
    if (!input || mentionStart === null) return;

    const value = editingId ? editText : text;
    const cursor = input.selectionStart ?? value.length;
    const before = value.slice(0, mentionStart);
    const after = value.slice(cursor);
    const next = `${before}@${userId} ${after}`;

    if (editingId) setEditText(next);
    else setText(next);

    setMentionOpen(false);
    setMentionQuery("");
    setMentionStart(null);

    requestAnimationFrame(() => {
      const pos = (before + `@${userId} `).length;
      input.focus();
      input.setSelectionRange(pos, pos);
    });
  }

  const myMembership = details?.members?.find(
    (m: any) => Number(m.userId) === Number(myId),
  );
  const myRole = String(myMembership?.role || "MEMBER");
  const canManageMembers = myRole === "OWNER" || myRole === "ADMIN";
  const canSetRoles = myRole === "OWNER";

  async function loadDetails() {
    setDetailsLoading(true);
    setDetailsError(null);
    try {
      const data = await getChatById(chatId);
      setDetails(data as any);
      setEditTitle(data.title ?? "");
    } catch (e: any) {
      setDetailsError(e?.response?.data?.message ?? "Не удалось загрузить данные чата");
    } finally {
      setDetailsLoading(false);
    }
  }

  useEffect(() => {
    if (detailsOpen) {
      loadDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailsOpen, chatId]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="p-3 border-b border-zinc-800 shrink-0 flex items-center justify-between gap-3">
        <button
          className="text-left hover:underline"
          onClick={() => setDetailsOpen(true)}
        >
          <div className="font-semibold truncate text-zinc-100">{headerTitle}</div>
          {directPresenceLabel && (
            <div className="text-xs text-zinc-400">{directPresenceLabel}</div>
          )}
        </button>
        <div className="text-xs text-zinc-500 shrink-0">#{chatId}</div>
      </div>

      {chat?.isGroup && (pinsOpen || pins.length > 0 || pinsLoading) && (
        <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-900">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs text-zinc-400">
              Закрепления{pins.length > 0 ? ` (${pins.length})` : ""}
            </div>
            <button
              className="text-xs underline text-zinc-400 hover:text-zinc-200"
              onClick={() => setPinsOpen((v) => !v)}
            >
              {pinsOpen ? "Свернуть" : "Развернуть"}
            </button>
          </div>
          {pinsLoading && <div className="text-xs text-zinc-500">Загрузка…</div>}
          {pinsOpen && !pinsLoading && pins.length === 0 && (
            <div className="text-xs text-zinc-500">Нет закреплённых сообщений</div>
          )}
          {pinsOpen && !pinsLoading && pins.length > 0 && (
            <div className="space-y-1 max-h-28 overflow-auto">
              {pins.map((p) => {
                const m = p.message;
                const author =
                  m?.author?.profile?.firstName || m?.author?.email || `User ${m?.author?.id}`;
                return (
                  <button
                    key={p.id}
                    className="text-xs border border-zinc-700 rounded px-2 py-1 text-left w-full hover:bg-zinc-800"
                    onClick={() => {
                      jumpToMessage(p.messageId);
                    }}
                  >
                    <div className="text-zinc-400">{author}</div>
                    <div className="truncate">
                      {m?.deletedAt ? "Сообщение удалено" : m?.text}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">

        {nextCursor && (
          <button onClick={loadMore} className="text-sm underline text-zinc-400">
            Load more
          </button>
        )}

        {items.map((m) => {
          const authorId = Number(m.authorId ?? m.userId ?? m.senderId ?? m.author?.id);
          const isMine = authorId === myId;
          const isDeleted = !!m.deletedAt;
          const showActions = !isDeleted;

          return (
            <div
              id={`msg-${m.id}`}
              key={m.id}
              className={`flex ${isMine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`
                  max-w-xs px-4 py-2 rounded-2xl shadow
                  ${
                    isMine
                      ? "bg-emerald-700 text-emerald-50 rounded-br-sm"
                      : "bg-zinc-800 text-zinc-100 rounded-bl-sm"
                  }
                `}
              >
                {m.replyTo && (
                  <div
                    className={`mb-2 px-2 py-1 rounded text-xs ${
                      isMine ? "bg-emerald-200/20" : "bg-zinc-700/60"
                    }`}
                  >
                    <div className="font-semibold">
                      {m.replyTo.author?.profile?.firstName ||
                        m.replyTo.author?.email ||
                        "Сообщение"}
                    </div>
                    <div className="truncate">{m.replyTo.text || "Удалено"}</div>
                  </div>
                )}

                {!isMine && (
                  <div className="text-xs font-semibold mb-1">
                    {m.author?.profile?.firstName || m.author?.email || "Unknown"}
                  </div>
                )}

                <div className={isDeleted ? "text-zinc-500 italic" : ""}>
                  {isDeleted ? "Сообщение удалено" : renderMessageText(m.text || "")}
                </div>

                <div className={`text-[10px] mt-1 flex items-center gap-2 ${isMine ? "text-emerald-100/90" : "text-zinc-400"}`}>
                  <span>{new Date(m.createdAt).toLocaleTimeString()}</span>
                  {m.editedAt && !isDeleted && <span>ред.</span>}

                  {isMine && (
                    <span>
                      {isReadBySomeoneElse(m.createdAt) ? "✓✓" : "✓"}
                    </span>
                  )}
                </div>

                <div
                  className={`mt-1 flex gap-2 text-[10px] ${
                    isMine ? "text-emerald-100/90" : "text-zinc-400"
                  }`}
                >
                  {showActions && (
                    <button
                      className={isMine ? "underline hover:text-emerald-50" : "underline hover:text-zinc-200"}
                      onClick={() => {
                        setReplyTo(m);
                        inputRef.current?.focus();
                      }}
                    >
                      Ответить
                    </button>
                  )}

                  {chat?.isGroup && showActions && (
                    <button
                      className={isMine ? "underline hover:text-emerald-50" : "underline hover:text-zinc-200"}
                      onClick={async () => {
                        if (pinnedIds.has(m.id)) {
                          await unpinChatMessage(chatId, m.id);
                        } else {
                          await pinChatMessage(chatId, m.id);
                        }
                        try {
                          setPins(await getChatPins(chatId));
                        } catch {
                        }
                      }}
                    >
                      {pinnedIds.has(m.id) ? "Открепить" : "Закрепить"}
                    </button>
                  )}

                  {isMine && showActions && (
                    <>
                      <button
                        className="underline hover:text-emerald-50"
                        onClick={() => {
                          setEditingId(m.id);
                          setEditText(m.text || "");
                          setReplyTo(null);
                          inputRef.current?.focus();
                        }}
                      >
                        Ред.
                      </button>
                      <button
                        className="underline text-rose-200 hover:text-rose-100"
                        onClick={async () => {
                          await deleteMessage(chatId, m.id);
                        }}
                      >
                        Удалить
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {typingUsers.size > 0 && (
        <div className="px-3 py-1 text-xs text-zinc-400">
          {typingUsers.size === 1
            ? `${Array.from(typingUsers.values())[0]} печатает…`
            : `${typingUsers.size} человека печатают…`}
        </div>
      )}

      <form onSubmit={onSend} className="p-3 border-t border-zinc-800 flex gap-2 shrink-0 bg-zinc-950">
        <div className="flex-1 flex flex-col gap-2">
          {(replyTo || editingId) && (
            <div className="text-xs bg-zinc-900 border border-zinc-800 rounded px-2 py-1 flex items-center justify-between">
              <div className="truncate">
                {editingId
                  ? "Редактирование сообщения"
                  : `Ответ на: ${
                      replyTo?.author?.profile?.firstName ||
                      replyTo?.author?.email ||
                      "сообщение"
                    }`}
              </div>
              <button
                className="underline text-zinc-400 hover:text-zinc-200"
                onClick={() => {
                  setReplyTo(null);
                  setEditingId(null);
                  setEditText("");
                }}
              >
                Отменить
              </button>
            </div>
          )}

          <div className="relative">
            <input
              ref={inputRef}
              className="border border-zinc-700 bg-zinc-900 rounded p-2 flex-1 w-full text-zinc-100 placeholder:text-zinc-500"
              placeholder="Написать сообщение..."
              value={editingId ? editText : text}
              onChange={(e) => {
                const v = e.target.value;
                if (editingId) setEditText(v);
                else setText(v);

                onChangeTextValue(v, e.target.selectionStart);

                const socket = getSocket();
                socket.emit("typing", { chatId });

                if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
                typingTimerRef.current = setTimeout(() => {
                  socket.emit("stop_typing", { chatId });
                }, 800);
              }}
              onBlur={() => {
                setTimeout(() => setMentionOpen(false), 100);
              }}
              onFocus={() => {
                const input = inputRef.current;
                if (input) onChangeTextValue(input.value, input.selectionStart);
              }}
              onKeyDown={(e) => {
                if (!mentionOpen || mentionCandidates.length === 0) return;

                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setMentionIndex((i) => (i + 1) % mentionCandidates.length);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setMentionIndex((i) =>
                    (i - 1 + mentionCandidates.length) % mentionCandidates.length,
                  );
                } else if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  const m = mentionCandidates[mentionIndex];
                  if (m) applyMention(Number(m.userId ?? m.id));
                } else if (e.key === "Escape") {
                  setMentionOpen(false);
                }
              }}
            />

            {chat?.isGroup && mentionOpen && mentionCandidates.length > 0 && (
              <div className="absolute bottom-full mb-2 left-0 right-0 max-h-40 overflow-auto border border-zinc-700 rounded bg-zinc-900 shadow">
                {mentionCandidates.map((m, idx) => {
                  const id = Number(m.userId ?? m.id);
                  const label = getMemberLabelById(id);
                  return (
                    <button
                      type="button"
                      key={id}
                      className={[
                        "w-full text-left px-2 py-1 text-sm text-zinc-100",
                        idx === mentionIndex ? "bg-zinc-800" : "hover:bg-zinc-800",
                      ].join(" ")}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyMention(id)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <button className="bg-emerald-500 text-zinc-950 rounded px-4">
          {editingId ? "Сохранить" : "Send"}
        </button>
      </form>

      {detailsOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-zinc-900 text-zinc-100 border border-zinc-800 w-full max-w-lg rounded-lg shadow-lg overflow-hidden">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div className="font-semibold">
                {chat?.isGroup ? "Настройки чата" : "Профиль пользователя"}
              </div>
              <button
                className="text-sm underline text-zinc-400 hover:text-zinc-200"
                onClick={() => setDetailsOpen(false)}
              >
                Закрыть
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {detailsLoading && <div>Загрузка...</div>}
              {detailsError && <div className="text-sm text-rose-400">{detailsError}</div>}

              {!detailsLoading && details && !chat?.isGroup && (
                (() => {
                  const other = details.members?.find(
                    (m: any) => Number(m.userId) !== Number(myId),
                  );
                  const p = other?.user?.profile || {};
                  const name = [p?.firstName, p?.lastName].filter(Boolean).join(" ");
                  return (
                    <div className="space-y-2">
                      <div className="text-lg font-semibold">
                        {name || other?.user?.email || `User #${other?.userId}`}
                      </div>
                      <div
                        className={
                          other?.user?.presenceStatus === "ONLINE"
                            ? "text-sm text-emerald-300"
                            : other?.user?.presenceStatus === "DO_NOT_DISTURB"
                              ? "text-sm text-amber-300"
                              : "text-sm text-zinc-400"
                        }
                      >
                        {getPresenceLabel(other?.user, true)}
                      </div>
                      {other?.user?.email && (
                        <div className="text-sm text-zinc-400">{other.user.email}</div>
                      )}
                      {p?.position && <div className="text-sm">Должность: {p.position}</div>}
                      {p?.department && <div className="text-sm">Отдел: {p.department}</div>}
                    </div>
                  );
                })()
              )}

              {!detailsLoading && details && chat?.isGroup && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="text-sm text-zinc-400">Название</div>
                    <div className="flex gap-2">
                      <input
                        className="border border-zinc-700 bg-zinc-950 rounded p-2 flex-1 text-zinc-100 placeholder:text-zinc-500"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        disabled={!canManageMembers}
                      />
                      <button
                        className="bg-emerald-500 text-zinc-950 rounded px-3 text-sm disabled:opacity-60"
                        disabled={!canManageMembers || savingTitle}
                        onClick={async () => {
                          if (savingTitle) return;
                          setSavingTitle(true);
                          try {
                            await updateChatTitle(chatId, editTitle.trim() || undefined);
                            await loadDetails();
                          } catch (e: any) {
                            setDetailsError(
                              e?.response?.data?.message ?? "Не удалось обновить чат",
                            );
                          } finally {
                            setSavingTitle(false);
                          }
                        }}
                      >
                        {savingTitle ? "Сохраняем..." : "Сохранить"}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm text-zinc-400">Участники</div>
                    <div className="space-y-2">
                      {details.members?.map((m: any) => {
                        const p = m.user?.profile || {};
                        const name = [p?.firstName, p?.lastName].filter(Boolean).join(" ");
                        const label = name || m.user?.email || `User #${m.userId}`;
                        const isOwner = String(m.role) === "OWNER";
                        const canRemove =
                          canManageMembers &&
                          !isOwner &&
                          Number(m.userId) !== Number(myId);

                        return (
                          <div key={m.userId} className="flex items-center gap-2">
                            <div className="flex-1 truncate">
                              <div className="text-sm font-medium">{label}</div>
                              <div
                                className={
                                  m.user?.presenceStatus === "ONLINE"
                                    ? "text-xs text-emerald-300"
                                    : m.user?.presenceStatus === "DO_NOT_DISTURB"
                                      ? "text-xs text-amber-300"
                                      : "text-xs text-zinc-500"
                                }
                              >
                                {getPresenceLabel(m.user, true)}
                              </div>
                              {m.user?.email && (
                                <div className="text-xs text-zinc-400">
                                  {m.user.email}
                                </div>
                              )}
                            </div>

                            {canSetRoles && !isOwner && (
                              <select
                                className="border border-zinc-700 bg-zinc-950 rounded px-2 py-1 text-sm text-zinc-100"
                                value={String(m.role)}
                                onChange={async (e) => {
                                  const role = e.target.value as "ADMIN" | "MEMBER";
                                  try {
                                    await setChatMemberRole(chatId, m.userId, role);
                                    await loadDetails();
                                  } catch (err: any) {
                                    setDetailsError(
                                      err?.response?.data?.message ??
                                        "Не удалось изменить роль",
                                    );
                                  }
                                }}
                              >
                                <option value="ADMIN">ADMIN</option>
                                <option value="MEMBER">MEMBER</option>
                              </select>
                            )}

                            {!canSetRoles && (
                              <div className="text-xs text-zinc-400">{m.role}</div>
                            )}

                            {canRemove && (
                              <button
                                className="text-xs underline text-rose-400 disabled:opacity-60 hover:text-rose-300"
                                disabled={mutatingMember}
                                onClick={async () => {
                                  if (mutatingMember) return;
                                  setMutatingMember(true);
                                  try {
                                    await removeChatMember(chatId, m.userId);
                                    await loadDetails();
                                  } catch (err: any) {
                                    setDetailsError(
                                      err?.response?.data?.message ??
                                        "Не удалось удалить участника",
                                    );
                                  } finally {
                                    setMutatingMember(false);
                                  }
                                }}
                              >
                                Удалить
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {canManageMembers && (
                    <div className="space-y-2">
                      <div className="text-sm text-zinc-400">Добавить участника</div>
                      <div className="flex gap-2">
                        <input
                          className="border border-zinc-700 bg-zinc-950 rounded p-2 flex-1 text-zinc-100 placeholder:text-zinc-500"
                          placeholder="User ID"
                          value={memberInput}
                          onChange={(e) => setMemberInput(e.target.value)}
                        />
                        <button
                          className="bg-emerald-500 text-zinc-950 rounded px-3 text-sm disabled:opacity-60"
                          disabled={mutatingMember}
                          onClick={async () => {
                            const id = Number(memberInput);
                            if (!id) {
                              setDetailsError("Введите корректный userId");
                              return;
                            }
                            setMutatingMember(true);
                            try {
                              await addChatMembers(chatId, [id]);
                              setMemberInput("");
                              await loadDetails();
                            } catch (err: any) {
                              setDetailsError(
                                err?.response?.data?.message ??
                                  "Не удалось добавить участника",
                              );
                            } finally {
                              setMutatingMember(false);
                            }
                          }}
                        >
                          Добавить
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
