"use client";

import type React from "react";

import { useState, useEffect } from "react";
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
import { ArrowLeft, Mail } from "lucide-react";
import Image from "next/image";
import logo from "../../../../public/Logo.jpg"

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isEmailSent, setIsEmailSent] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [canResend, setCanResend] = useState(true);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (resendCooldown > 0) {
            timer = setInterval(() => {
                setResendCooldown((prev) => {
                    if (prev <= 1) {
                        setCanResend(true);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [resendCooldown]);

    const startResendCooldown = (seconds: number = 60) => {
        setCanResend(false);
        setResendCooldown(seconds);
    };

    const handleSendOTP = async (e: React.FormEvent) => {
        e.preventDefault();

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            toast("Please enter a valid email address.");
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email,
                    action: "send-otp",
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to send OTP");
            }

            setIsEmailSent(true);
            startResendCooldown(60);
            toast("OTP sent to your email address.");
        } catch (error: unknown) {
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : "Failed to send OTP. Please try again.";
            toast(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendEmail = async () => {
        if (!canResend) return;

        setIsLoading(true);
        try {
            const response = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email,
                    action: "send-otp",
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to resend OTP");
            }

            startResendCooldown(60);
            toast("OTP has been sent again.");
        } catch (error: unknown) {
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : "Failed to resend OTP. Please try again.";
            toast(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    if (isEmailSent) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center bg-[#e3f2fd] py-12 px-4 sm:px-6 lg:px-8">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                            <Mail className="h-6 w-6 text-green-600" />
                        </div>
                        <CardTitle className="text-2xl font-bold">
                            Check your email
                        </CardTitle>
                        <CardDescription>
                            We&apos;ve sent an OTP to{" "}
                            <span className="font-medium text-gray-900">{email}</span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="text-center text-sm text-gray-600">
                            {"Didn't receive the OTP? Check your spam folder or "}
                            <button
                                onClick={handleResendEmail}
                                disabled={isLoading || !canResend}
                                className={`font-medium ${canResend && !isLoading
                                    ? "text-blue-600 hover:text-blue-500 hover:underline"
                                    : "text-gray-400 cursor-not-allowed"
                                    }`}
                            >
                                {!canResend && resendCooldown > 0
                                    ? `Resend OTP in ${resendCooldown}s`
                                    : "resend OTP"}
                            </button>
                        </div>

                        <Link href={`/reset-password?email=${encodeURIComponent(email)}`}>
                            <Button className="w-full">Enter OTP & Reset Password</Button>
                        </Link>

                        <Link href="/login">
                            <Button variant="outline" className="w-full bg-transparent">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to login
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#e3f2fd] py-12 px-4 sm:px-6 lg:px-8 relative">
            {/* Removed absolute logo at top-left */}
            <Card className="mt-[150px] md:mt-[0px] w-full max-w-md">
                <CardHeader className="text-center space-y-4">
                    {/* Centered logo inside the card */}
                    <div className="flex justify-center">
                        <Image className="h-[50px] w-[220px]" src={logo} alt="logo" />
                    </div>
                    <CardTitle className="text-2xl font-bold">Forgot Password</CardTitle>
                    <CardDescription>
                        Enter your email address and we&apos;ll send you an OTP to reset
                        your password
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleSendOTP}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your email address"
                                required
                            />
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
                                    Sending OTP...
                                </span>
                            ) : (
                                <span className="flex items-center">
                                    <Mail className="mr-2 h-4 w-4" />
                                    Send OTP
                                </span>
                            )}
                        </Button>

                        <Link href="/login">
                            <Button variant="outline" className="w-full bg-transparent">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to login
                            </Button>
                        </Link>
                    </CardContent>
                </form>
            </Card>
        </div>
    );
}
