"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

export function useAuthGuard() {
  const router = useRouter();

  // Memoize protected routes to avoid dependency issues
  const protectedRoutes = useMemo(
    () => ["/dashboard", "/agent", "/client", "/task", "/setting"],
    []
  );

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem("token");
      const currentPath = window.location.pathname;

      // Handle root route
      if (currentPath === "/") {
        if (token) {
          router.replace("/dashboard");
        } else {
          router.replace("/login");
        }
        return;
      }

      // Check if current route is protected
      const isProtectedRoute = protectedRoutes.some((route) =>
        currentPath.startsWith(route)
      );

      // If no token and on protected route, redirect to login immediately
      if (isProtectedRoute && !token) {
        router.replace("/login");
      }
    };

    checkAuth();

    // Also listen for storage changes (when logout happens in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "token" && !e.newValue) {
        checkAuth();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [router, protectedRoutes]);
}

export function useAuthRedirect() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    const currentPath = window.location.pathname;

    // List of auth pages
    const authRoutes = [
      "/login",
      "/forgot-password",
      "/reset-password",
    ];

    // Check if current route is an auth page
    const isAuthRoute = authRoutes.some((route) =>
      currentPath.startsWith(route)
    );

    // If token exists and on auth page, redirect to dashboard
    if (isAuthRoute && token) {
      router.replace("/dashboard");
    }
  }, [router]);
}