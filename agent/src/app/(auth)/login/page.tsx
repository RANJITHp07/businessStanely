"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, LogIn, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [forceLoginLoading, setForceLoginLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForceLogin, setShowForceLogin] = useState(false);

  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent, force = false) => {
    e.preventDefault();
    setError("");
    setShowForceLogin(false);
    if (force) setForceLoginLoading(true);
    else setIsLoading(true);

    // Custom login logic to support force login
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, force }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.error === "already_logged_in") {
          setShowForceLogin(true);
          setError(data.message || "User is already logged in elsewhere.");
          return;
        }
        setError(data.error || "Login failed");
        return;
      }
      // Store authentication data
      localStorage.setItem("agent", JSON.stringify(data.agent));
      localStorage.setItem("token", data.token);
      router.push("/dashboard");
    } catch (err) {
      setError("Login failed. Please try again.");
    } finally {
      setIsLoading(false);
      setForceLoginLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#e3f2fd] py-12 px-4 sm:px-6 lg:px-8 relative">
      <Card className="mt-[150px] md:mt-[0px] w-full max-w-md bg-white">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <Image src="/Logo.jpg" alt="logo" width={220} height={50} className="h-[50px] w-[220px]" />
          </div>
          <CardTitle className="text-2xl font-bold text-black">Agent Sign In</CardTitle>
          <CardDescription className="text-black">
            Enter your credentials to access your agent account
          </CardDescription>
        </CardHeader>
  <form onSubmit={(e) => handleLogin(e)}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md">
                {error}
              </div>
            )}
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
            <div className="space-y-2">
              <Label className="text-black" htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                className="text-black placeholder:text-black"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {/* <p className="text-xs text-red-500">Email error</p> */}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-black">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  className="text-black placeholder:text-black pr-12"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-black"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              <span className="flex items-center">
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <LogIn className="mr-2 h-4 w-4" />
                )}
                {isLoading ? "Signing In..." : "Sign In"}
              </span>
            </Button>
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
