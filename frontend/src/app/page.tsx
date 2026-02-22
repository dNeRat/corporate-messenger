"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/axios";
import { ChatList } from "@/components/ChatList";
import { ChatWindow } from "@/components/ChatWindow";
export default function HomePage() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/auth/me");
        setMe(res.data);
      } catch {
        router.replace("/login");
      }
    })();
  }, [router]);

  if (!me) return null;

  return (
    <div className="h-screen grid grid-cols-[320px_1fr]">
  <ChatList selectedChatId={selectedChatId} onSelect={setSelectedChatId} />
  <div className="h-full">
    {selectedChatId ? (<ChatWindow chatId={selectedChatId} me={me} />) : (<div className="p-6 text-gray-600">Выбери чат слева</div>)}
  </div>
</div>
  );
}