"use client";

import { useEffect, useRef, useState } from "react";
import { getMessages, sendMessage } from "@/lib/messages";
import { getSocket } from "@/lib/socket";

export function ChatWindow({ chatId }: { chatId: number }) {
  const [items, setItems] = useState<any[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      const page = await getMessages(chatId, undefined, 30);
      if (!alive) return;
      setItems(page.items.reverse()); // чтобы старые сверху
      setNextCursor(page.nextCursor);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    })();

    const socket = getSocket();
    socket.on("connect", () => console.log("WS connected", socket.id));
    socket.on("disconnect", (r) => console.log("WS disconnected", r));
    socket.on("connect_error", (e) => console.log("WS connect_error", e?.message || e));
    socket.on("error", (e) => console.log("WS error event", e));

    socket.emit("join_chat", { chatId }, (ack: any) => {
      console.log("join ack", ack)
    });

    const onNew = (payload: any) => {
      if (Number(payload.chatId) !== Number(chatId)) return;
      setItems((prev) => [...prev, payload]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 10);
    };

    socket.on("new_message", onNew);
    socket.on("new_message", (p) => console.log("WS new_message:", p));
    socket.on("error", (e) => console.log("WS error:", e));

    return () => {
      alive = false;
      socket.off("new_message", onNew);
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

  setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 10);
}

  async function loadMore() {
    if (!nextCursor) return;
    const page = await getMessages(chatId, nextCursor, 30);
    setNextCursor(page.nextCursor);
    setItems((prev) => [...page.items.reverse(), ...prev]);
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b font-semibold">Chat #{chatId}</div>

      <div className="flex-1 overflow-auto p-3 space-y-2">
        {nextCursor && (
          <button onClick={loadMore} className="text-sm underline text-gray-600">
            Load more
          </button>
        )}

        {items.map((m) => (
          <div key={m.id} className="p-2 rounded bg-gray-100">
            <div className="text-sm text-gray-700">{m.text}</div>
            <div className="text-xs text-gray-500">{new Date(m.createdAt).toLocaleString()}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={onSend} className="p-3 border-t flex gap-2">
        <input
          className="border rounded p-2 flex-1"
          placeholder="Написать сообщение..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="bg-black text-white rounded px-4">Send</button>
      </form>
    </div>
  );
}