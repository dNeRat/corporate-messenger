"use client";

import { useEffect, useRef, useState } from "react";
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
  onConsumedFirstUnread,
}: {
  chatId: number;
  chat: Chat | null;
  me: any;
  firstUnreadId: number | null;
  onConsumedFirstUnread: () => void;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
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
  const [pins, setPins] = useState<any[]>([]);
  const [pinsLoading, setPinsLoading] = useState(false);
  const [pinsOpen, setPinsOpen] = useState(true);

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
    let alive = true;

    setTypingUsers(new Map());
    setReadMap({});
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    setReplyTo(null);
    setEditingId(null);
    setEditText("");
    setPins([]);

    (async () => {
      const page = await getMessages(chatId, undefined, 30);
      if (!alive) return;

      setItems(page.items.reverse());
      setNextCursor(page.nextCursor);
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
          onConsumedFirstUnread();
        } else {
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
          setPins(await getChatPins(chatId));
        } catch {
        } finally {
          setPinsLoading(false);
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
      if (!pendingFirstUnreadRef.current) {
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

    socket.on("new_message", onNew);
    socket.on("typing", onTyping);
    socket.on("stop_typing", onStopTyping);
    socket.on("read_receipt", onReadReceipt);
    socket.on("message_updated", onMessageUpdated);
    socket.on("message_deleted", onMessageDeleted);

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
    };
  }, [chatId, myId, onConsumedFirstUnread]);

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

  const pinnedIds = new Set(pins.map((p) => Number(p.messageId)));

  function renderMessageText(textValue: string) {
    const mention = `@${myId}`;
    if (!textValue || !mention) return textValue;

    const parts = textValue.split(mention);
    if (parts.length === 1) return textValue;
    return parts.flatMap((part, idx) =>
      idx < parts.length - 1
        ? [
            part,
            <span key={`m-${idx}`} className="bg-yellow-200 text-black px-1 rounded">
              {mention}
            </span>,
          ]
        : [part],
    );
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
      <div className="p-3 border-b shrink-0 flex items-center justify-between gap-3">
        <button
          className="font-semibold truncate text-left hover:underline"
          onClick={() => setDetailsOpen(true)}
        >
          {headerTitle}
        </button>
        <div className="text-xs text-gray-500 shrink-0">#{chatId}</div>
      </div>

      {chat?.isGroup && (
        <div className="px-3 py-2 border-b bg-white">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs text-gray-500">
              Закрепления{pins.length > 0 ? ` (${pins.length})` : ""}
            </div>
            <button
              className="text-xs underline text-gray-600"
              onClick={() => setPinsOpen((v) => !v)}
            >
              {pinsOpen ? "Свернуть" : "Развернуть"}
            </button>
          </div>
          {pinsLoading && <div className="text-xs text-gray-400">Загрузка…</div>}
          {pinsOpen && !pinsLoading && pins.length === 0 && (
            <div className="text-xs text-gray-400">Нет закреплённых сообщений</div>
          )}
          {pinsOpen && !pinsLoading && pins.length > 0 && (
            <div className="space-y-1 max-h-28 overflow-auto">
              {pins.map((p) => {
                const m = p.message;
                const author =
                  m?.author?.profile?.firstName || m?.author?.email || `User ${m?.author?.id}`;
                return (
                  <div key={p.id} className="text-xs border rounded px-2 py-1">
                    <div className="text-gray-600">{author}</div>
                    <div className="truncate">
                      {m?.deletedAt ? "Сообщение удалено" : m?.text}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">

        {nextCursor && (
          <button onClick={loadMore} className="text-sm underline text-gray-600">
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
                      ? "bg-black text-white rounded-br-sm"
                      : "bg-gray-200 text-black rounded-bl-sm"
                  }
                `}
              >
                {m.replyTo && (
                  <div
                    className={`mb-2 px-2 py-1 rounded text-xs ${
                      isMine ? "bg-white/20" : "bg-black/10"
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

                <div className={isDeleted ? "text-gray-500 italic" : ""}>
                  {isDeleted ? "Сообщение удалено" : renderMessageText(m.text || "")}
                </div>

                <div className={`text-[10px] mt-1 flex items-center gap-2 ${isMine ? "text-gray-300" : "text-gray-600"}`}>
                  <span>{new Date(m.createdAt).toLocaleTimeString()}</span>
                  {m.editedAt && !isDeleted && <span>ред.</span>}

                  {isMine && (
                    <span>
                      {isReadBySomeoneElse(m.createdAt) ? "✓✓" : "✓"}
                    </span>
                  )}
                </div>

                <div className="mt-1 flex gap-2 text-[10px]">
                  {showActions && (
                    <button
                      className="underline"
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
                      className="underline"
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
                        className="underline"
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
                        className="underline text-red-600"
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
        <div className="px-3 py-1 text-xs text-gray-500">
          {typingUsers.size === 1
            ? `${Array.from(typingUsers.values())[0]} печатает…`
            : `${typingUsers.size} человека печатают…`}
        </div>
      )}

      <form onSubmit={onSend} className="p-3 border-t flex gap-2 shrink-0">
        <div className="flex-1 flex flex-col gap-2">
          {(replyTo || editingId) && (
            <div className="text-xs bg-gray-100 rounded px-2 py-1 flex items-center justify-between">
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
                className="underline"
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

          <input
            ref={inputRef}
            className="border rounded p-2 flex-1"
            placeholder="Написать сообщение..."
            value={editingId ? editText : text}
            onChange={(e) => {
              const v = e.target.value;
              if (editingId) setEditText(v);
              else setText(v);

              const socket = getSocket();
              socket.emit("typing", { chatId });

              if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
              typingTimerRef.current = setTimeout(() => {
                socket.emit("stop_typing", { chatId });
              }, 800);
            }}
          />
        </div>
        <button className="bg-black text-white rounded px-4">
          {editingId ? "Сохранить" : "Send"}
        </button>
      </form>

      {detailsOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-lg shadow-lg overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <div className="font-semibold">
                {chat?.isGroup ? "Настройки чата" : "Профиль пользователя"}
              </div>
              <button
                className="text-sm underline"
                onClick={() => setDetailsOpen(false)}
              >
                Закрыть
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {detailsLoading && <div>Загрузка...</div>}
              {detailsError && <div className="text-sm text-red-600">{detailsError}</div>}

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
                      {other?.user?.email && (
                        <div className="text-sm text-gray-600">{other.user.email}</div>
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
                    <div className="text-sm text-gray-600">Название</div>
                    <div className="flex gap-2">
                      <input
                        className="border rounded p-2 flex-1"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        disabled={!canManageMembers}
                      />
                      <button
                        className="bg-black text-white rounded px-3 text-sm disabled:opacity-60"
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
                    <div className="text-sm text-gray-600">Участники</div>
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
                              {m.user?.email && (
                                <div className="text-xs text-gray-600">
                                  {m.user.email}
                                </div>
                              )}
                            </div>

                            {canSetRoles && !isOwner && (
                              <select
                                className="border rounded px-2 py-1 text-sm"
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
                              <div className="text-xs text-gray-500">{m.role}</div>
                            )}

                            {canRemove && (
                              <button
                                className="text-xs underline text-red-600 disabled:opacity-60"
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
                      <div className="text-sm text-gray-600">Добавить участника</div>
                      <div className="flex gap-2">
                        <input
                          className="border rounded p-2 flex-1"
                          placeholder="User ID"
                          value={memberInput}
                          onChange={(e) => setMemberInput(e.target.value)}
                        />
                        <button
                          className="bg-black text-white rounded px-3 text-sm disabled:opacity-60"
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
