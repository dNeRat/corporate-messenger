"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/axios";

export default function HomePage() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/auth/me"); // cookie уйдёт в backend
        setMe(res.data);
      } catch {
        router.replace("/login");
      }
    })();
  }, [router]);

  if (!me) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold">Добро пожаловать, {me.email}</h1>
    </div>
  );
}