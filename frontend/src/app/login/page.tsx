"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/axios";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleLogin(e: React.FormEvent) {
  e.preventDefault();

  try {
    await api.post("/auth/login", { email, password });
    router.push("/");
  } catch (err: any) {
    alert(err?.response?.data?.message ?? "Login failed");
  }
}


  return (
    <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-100">
      <form onSubmit={handleLogin} className="flex flex-col gap-4 w-80 bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <h1 className="text-2xl font-bold">Login</h1>

        <input
          className="border border-zinc-700 bg-zinc-950 p-2 rounded text-zinc-100 placeholder:text-zinc-500"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          className="border border-zinc-700 bg-zinc-950 p-2 rounded text-zinc-100 placeholder:text-zinc-500"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button className="bg-emerald-500 text-zinc-950 p-2 rounded">
          Login
        </button>
      </form>
    </div>
  );
}
