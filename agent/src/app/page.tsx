"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootPage() {
  const router = useRouter();

useEffect(() => {
  const token = localStorage.getItem("token");
  if (token) {
    router.replace("/dashboard");
  } else {
    router.replace("/login");
  }
}, [router]);

  return (
    <div className="flex flex-col items-center w-full justify-center min-h-screen bg-white">
      <div className="animate-spin rounded-full h-[30px] w-[30px] md:h-20 md:w-20 border-4 border-gray-900 border-t-transparent"></div>
      <p className="mt-4 text-gray-700 text-lg font-medium">Redirecting...</p>
    </div>
  );
}
