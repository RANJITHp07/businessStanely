"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Agent {
  id: string;
  name: string;
  email: string;
  agentType: string;
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

      const data = await response.json();

      if (!response.ok) {
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
      return {
        success: false,
        error: error instanceof Error ? error.message : "Login failed",
      };
    }
  };

  const signup = async (userData: {
    name: string;
    email: string;
    password: string;
    phoneNumber: string;
    secondaryPhoneNumber?: string;
    agentType: string;
    barAssociationId: string;
    jurisdiction: string;
    specializations: string[];
  }) => {
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Signup failed");
      }

      return { success: true, data };
    } catch (error) {
      console.error("Signup error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Signup failed",
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

  return {
    ...authState,
    login,
    signup,
    logout,
  };
}
