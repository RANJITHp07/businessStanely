"use client";

import { useEffect, useState } from "react";
import AuthSessionTimeout from "@/components/AuthSessionTimeout";
import { useRouter } from "next/navigation";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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

      // List of protected routes
      const protectedRoutes = [
        "/dashboard",
        "/team",
        "/timesheet",
        "/task",
        "/setting",
        "/my-diary",
        "/retainership",
        "/client",
        "/legislation",
        "/task_category",
        "/service-records",
        "/request-quote",
        "/my-task",
      ];

      // Check if current route is protected
      const isProtectedRoute = protectedRoutes.some((route) =>
        currentPath.startsWith(route)
      );

      if (isProtectedRoute) {
        if (!token) {
          router.replace("/login");
          return;
        }
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(true);
      }

      setIsChecking(false);
    };

    checkAuth();

    // Listen for storage changes (logout in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "token" && !e.newValue) {
        const currentPath = window.location.pathname;
        const protectedRoutes = [
          "/dashboard",
          "/team",
          "/timesheet",
          "/task",
          "/setting",
          "/my-diary",
          "/retainership",
          "/client",
          "/legislation",
          "/task_category",
          "/service-records",
          "/request-quote",
          "/my-task",
        ];
        const isProtectedRoute = protectedRoutes.some((route) =>
          currentPath.startsWith(route)
        );

        if (isProtectedRoute) {
          router.replace("/login");
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [router]);

  // Show loading or redirect while checking
  if (isChecking) {
    return (
      <div className="flex flex-col items-center w-full justify-center min-h-screen bg-white">
        <div className="animate-spin rounded-full h-[30px] w-[30px] md:h-20 md:w-20 border-4 border-gray-900 border-t-transparent"></div>
        <p className="mt-4 text-gray-700 text-lg font-medium">Authenticating...</p>
      </div>
    );
  }


  // Only render children if authenticated (for protected routes)
  if (!isAuthenticated) {
    return null;
  }

  return <>
    <AuthSessionTimeout />
    {children}
  </>;
}