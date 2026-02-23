"use client";

import { useEffect, useRef, useState } from "react";
import { getMessages, sendMessage } from "@/lib/messages";
import { getSocket } from "@/lib/socket";

export function ChatWindow({
  chatId,
  me,
}: {
  chatId: number;
  me: any;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set());
  const typingTimerRef = useRef<any>(null);

useEffect(() => {
  let alive = true;

  (async () => {
    const page = await getMessages(chatId, undefined, 30);
    if (!alive) return;
    setItems(page.items.reverse());
    setNextCursor(page.nextCursor);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
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
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 10);
  };

  socket.on("new_message", onNew);

  const onTyping = (p: any) => {
  if (Number(p.chatId) !== Number(chatId)) return;
  const uid = Number(p.userId);
  if (uid === Number(me.sub ?? me.id)) return;

  setTypingUsers(prev => new Set(prev).add(uid));
};

const onStopTyping = (p: any) => {
  if (Number(p.chatId) !== Number(chatId)) return;
  const uid = Number(p.userId);

  setTypingUsers(prev => {
    const next = new Set(prev);
    next.delete(uid);
    return next;
  });
};

socket.on("typing", onTyping);
socket.on("stop_typing", onStopTyping);

  return () => {
    alive = false;
    socket.off("connect", onConnect);
    socket.off("disconnect", onDisconnect);
    socket.off("connect_error", onConnectError);
    socket.off("error", onError);
    socket.off("new_message", onNew);
    socket.off("typing", onTyping);
    socket.off("stop_typing", onStopTyping);
  };
}, [chatId]);

  async function onSend(e: React.FormEvent) {
  e.preventDefault();
  const t = text.trim();
  if (!t) return;

  setText("");

  const msg = await sendMessage(chatId, t);

  setItems((prev) => {
    if (prev.some((x) => x.id === msg.id)) return prev;
    return [...prev, msg];
  });
  getSocket().emit("stop_typing", { chatId });
  setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 10);
}

  async function loadMore() {
    if (!nextCursor) return;
    const page = await getMessages(chatId, nextCursor, 30);
    setNextCursor(page.nextCursor);
    setItems((prev) => [...page.items.reverse(), ...prev]);
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
        const myId = Number(me.sub ?? me.id);

        const authorId = Number(
        m.authorId ?? m.userId ?? m.senderId ?? m.author?.id
        );

        const isMine = authorId === myId;

  return (
    <div
      key={m.id}
      className={`flex ${isMine ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`
          max-w-xs px-4 py-2 rounded-2xl shadow
          ${isMine
            ? "bg-black text-white rounded-br-sm"
            : "bg-gray-200 text-black rounded-bl-sm"}
        `}
      >
        {!isMine && (
          <div className="text-xs font-semibold mb-1">
            {m.author?.profile?.firstName || m.author?.email}
          </div>
        )}

        <div>{m.text}</div>

        <div
          className={`text-[10px] mt-1 ${
            isMine ? "text-gray-300" : "text-gray-600"
          }`}
        >
          {new Date(m.createdAt).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
})}
        <div ref={bottomRef} />
      </div>
      {typingUsers.size > 0 && (
      <div className="px-3 py-1 text-xs text-gray-500">
        печатает…
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