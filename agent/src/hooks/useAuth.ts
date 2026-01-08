"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Agent {
  id: string;
  name: string;
  email: string;
  agentType: string;
  agentRole: 'Execution Agent' | 'Advisor Agent';
  phoneNumber: string;
  jurisdiction: string;
  specializations: string[];
  photo?: string;
}

interface AuthState {
  agent: Agent | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface ForgotPasswordData {
  otp?: string;
  newPassword?: string;
  confirmPassword?: string;
  [key: string]: unknown;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    agent: null,
    token: null,
    isLoading: true,
    isAuthenticated: false,
  });
  const router = useRouter();

  useEffect(() => {
    // Check for stored authentication data
    const storedAgent = localStorage.getItem("agent");
    const storedToken = localStorage.getItem("token");

    if (storedAgent && storedToken) {
      try {
        const agent = JSON.parse(storedAgent);
        setAuthState({
          agent,
          token: storedToken,
          isLoading: false,
          isAuthenticated: true,
        });
      } catch (error) {
        console.error("Error parsing stored agent data:", error);
        localStorage.removeItem("agent");
        localStorage.removeItem("token");
        setAuthState(prev => ({ ...prev, isLoading: false }));
      }
    } else {
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      // Check if response is actually JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server error. Please try again later.");
      }

      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error("Server error. Please try again later.");
      }

      if (!response.ok) {
        // For authentication errors (401), return the error without throwing
        if (response.status === 401) {
          return {
            success: false,
            error: data.error || "Invalid credentials",
          };
        }
        
        // For other errors (500, 429, etc.), throw the error
        throw new Error(data.error || "Login failed");
      }

      // Store authentication data
      localStorage.setItem("agent", JSON.stringify(data.agent));
      localStorage.setItem("token", data.token);

      setAuthState({
        agent: data.agent,
        token: data.token,
        isLoading: false,
        isAuthenticated: true,
      });

      return { success: true, data };
    } catch (error) {
      console.error("Login error:", error);
      
      // Provide user-friendly error messages
      let errorMessage = "Login failed. Please try again.";
      
      if (error instanceof Error) {
        if (error.message.includes("Failed to fetch")) {
          errorMessage = "Network error. Please check your connection and try again.";
        } else if (error.message.includes("Unexpected end of JSON input")) {
          errorMessage = "Server error. Please try again later.";
        } else {
          errorMessage = error.message;
        }
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  };



  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } catch (error) {
      console.error("Logout error:", error);
    }

    // Clear local storage
    localStorage.removeItem("agent");
    localStorage.removeItem("token");

    setAuthState({
      agent: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
    });

    router.push("/login");
  };

  const forgotPassword = async (email: string, action: string, additionalData?: ForgotPasswordData) => {
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, action, ...additionalData }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Operation failed");
      }

      return { success: true, data };
    } catch (error) {
      console.error("Forgot password error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Operation failed",
      };
    }
  };

  const fetchProfile = async () => {
    try {
      const response = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setAuthState(prev => ({
          ...prev,
          agent: data.agent,
          isAuthenticated: true,
        }));
        return { success: true, data: data.agent };
      } else {
        // If profile fetch fails, clear auth state
        localStorage.removeItem("agent");
        localStorage.removeItem("token");
        setAuthState({
          agent: null,
          token: null,
          isLoading: false,
          isAuthenticated: false,
        });
        return { success: false, error: "Session expired" };
      }
    } catch (error) {
      console.error("Fetch profile error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch profile",
      };
    }
  };

  return {
    ...authState,
    login,
    logout,
    forgotPassword,
    fetchProfile,
  };
}
