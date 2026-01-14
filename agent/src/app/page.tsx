"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootPage() {
  const router = useRouter();

useEffect(() => {
  const token = localStorage.getItem("token");
  if (!token) {
    router.replace("/login");
    return;
  }
  // Fetch agent info from API or decode token (if agentRole is in token)
  fetch("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((res) => res.json())
    .then((data) => {
      const agent = data.agent;
      if (agent) {
        localStorage.setItem("agent", JSON.stringify(agent));
      }
      if (!agent || !agent.agentRole) {
        router.replace("/dashboard"); // fallback
      } else if (agent.agentRole === "Advisor Agent") {
        router.replace("/sales/dashboard");
      } else {
        router.replace("/dashboard");
      }
    })
    .catch(() => {
      router.replace("/dashboard");
    });
}, [router]);

  return (
    <div className="flex flex-col items-center w-full justify-center min-h-screen bg-white">
      <div className="animate-spin rounded-full h-[30px] w-[30px] md:h-20 md:w-20 border-4 border-gray-900 border-t-transparent"></div>
      <p className="mt-4 text-gray-700 text-lg font-medium">Redirecting...</p>
    </div>
  );
}
