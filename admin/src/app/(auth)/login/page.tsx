"use client";

import type React from "react";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "react-toastify";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { useAuthRedirect } from "@/hooks/useAuth";
import Image from "next/image";
import logo from "../../../../public/Logo.jpg";

export default function LoginPage() {
  const router = useRouter();
  // Redirect if already logged in
  useAuthRedirect();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [forceLoginLoading, setForceLoginLoading] = useState(false);
  const [showForceLogin, setShowForceLogin] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({
    email: "",
    password: "",
  });

  const clearFieldError = (field: "email" | "password") => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleLogin = async (e: React.FormEvent, force = false) => {
    e.preventDefault();
    setFieldErrors({ email: "", password: "" });
    setShowForceLogin(false);

    if (!password || !email) {
      const errorMessage = "Please fill in all required fields";
      toast(errorMessage);
      return;
    }

    if (force) setForceLoginLoading(true);
    else setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim() || undefined,
          password,
          force,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === "already_logged_in") {
          setShowForceLogin(true);
          throw new Error(data.message || "User is already logged in elsewhere.");
        }
        const errorMessage = data.error || "Login failed. Please try again.";
        setFieldErrors({
          email: "Please check your credentials",
          password: "Please check your credentials",
        });
        throw new Error(errorMessage);
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      toast("Welcome back!");
      router.push("/dashboard");
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Login failed. Please try again.";
      toast(errorMessage);
    } finally {
      setIsLoading(false);
      setForceLoginLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#e3f2fd] py-12 px-4 sm:px-6 lg:px-8 relative">
      
      {/* Removed absolute top-left logo */}

      <Card className="mt-[150px] md:mt-[0px] w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          {/* Centered logo inside the card */}
          <div className="flex justify-center">
            <Image src={logo} alt="logo" className="h-[50px] w-[220px]" />
          </div>
          <CardTitle className="text-2xl font-bold">Sign In</CardTitle>
          <CardDescription>
            Enter your credentials to access your account
          </CardDescription>
        </CardHeader>
        <form onSubmit={(e) => handleLogin(e)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearFieldError("email");
                }}
                placeholder="Enter your email"
                className={fieldErrors.email ? "border-red-500" : ""}
                required
              />
              {fieldErrors.email && (
                <p className="text-xs text-red-500">{fieldErrors.email}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearFieldError("password");
                  }}
                  placeholder="Enter your password"
                  required
                  className={fieldErrors.password ? "border-red-500" : ""}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {fieldErrors.password && (
                <p className="text-xs text-red-500">{fieldErrors.password}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center">
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign In
                </span>
              )}
            </Button>
            {showForceLogin && (
              <Button
                type="button"
                className="w-full mt-2"
                variant="destructive"
                disabled={forceLoginLoading}
                onClick={(e) => handleLogin(e, true)}
              >
                {forceLoginLoading ? "Forcing login..." : "Force Login (Logout other session)"}
              </Button>
            )}
            <div className="text-center space-y-2">
              <Link
                href="/forgot-password"
                className="text-sm text-blue-600 hover:text-blue-500 hover:underline"
              >
                Forgot your password?
              </Link>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
