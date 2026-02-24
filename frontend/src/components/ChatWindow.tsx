"use client";

import { useEffect, useRef, useState } from "react";
import { getMessages, sendMessage } from "@/lib/messages";
import { getSocket } from "@/lib/socket";
import { api } from "@/lib/axios";

export function ChatWindow({
  chatId,
  me,
  firstUnreadId,
  onConsumedFirstUnread,
}: {
  chatId: number;
  me: any;
  firstUnreadId: number | null;
  onConsumedFirstUnread: () => void;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [text, setText] = useState("");

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [typingUsers, setTypingUsers] = useState<Map<number, string>>(new Map());
  const typingTimerRef = useRef<any>(null);

  const [readMap, setReadMap] = useState<Record<number, string>>({});

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

    (async () => {
      const page = await getMessages(chatId, undefined, 30);
      if (!alive) return;

      setItems(page.items.reverse());
      setNextCursor(page.nextCursor);

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

    socket.on("new_message", onNew);
    socket.on("typing", onTyping);
    socket.on("stop_typing", onStopTyping);
    socket.on("read_receipt", onReadReceipt);

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
    };
  }, [chatId, myId, onConsumedFirstUnread]);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;

    setText("");

    const msg = await sendMessage(chatId, t);

    // fallback, если WS задержится
    setItems((prev) => (prev.some((x) => x.id === msg.id) ? prev : [...prev, msg]));

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

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="p-3 border-b font-semibold shrink-0">Chat #{chatId}</div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {nextCursor && (
          <button onClick={loadMore} className="text-sm underline text-gray-600">
            Load more
          </button>
        )}

        {items.map((m) => {
          const authorId = Number(m.authorId ?? m.userId ?? m.senderId ?? m.author?.id);
          const isMine = authorId === myId;

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
                {!isMine && (
                  <div className="text-xs font-semibold mb-1">
                    {m.author?.profile?.firstName || m.author?.email || "Unknown"}
                  </div>
                )}

                <div>{m.text}</div>

                <div className={`text-[10px] mt-1 flex items-center gap-2 ${isMine ? "text-gray-300" : "text-gray-600"}`}>
                  <span>{new Date(m.createdAt).toLocaleTimeString()}</span>

                  {isMine && (
                    <span>
                      {isReadBySomeoneElse(m.createdAt) ? "✓✓" : "✓"}
                    </span>
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
        <input
          className="border rounded p-2 flex-1"
          placeholder="Написать сообщение..."
          value={text}
          onChange={(e) => {
            const v = e.target.value;
            setText(v);

            const socket = getSocket();
            socket.emit("typing", { chatId });

            if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
            typingTimerRef.current = setTimeout(() => {
              socket.emit("stop_typing", { chatId });
            }, 800);
          }}
        />
        <button className="bg-black text-white rounded px-4">Send</button>
      </form>
    </div>
  );
}