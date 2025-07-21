"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "react-toastify";
import { ArrowLeft, Mail } from "lucide-react"

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [isEmailSent, setIsEmailSent] = useState(false)

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault()

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            toast("Please enter a valid email address.")
            return
        }

        setIsLoading(true)

        try {
            // Simulate API call for password reset
            await new Promise((resolve) => setTimeout(resolve, 2000))
            setIsEmailSent(true)
            toast(
                "Check your email for password reset instructions.")
        } catch (error) {
            toast("Failed to send reset email. Please try again.")
        } finally {
            setIsLoading(false)
        }
    }

    const handleResendEmail = async () => {
        setIsLoading(true)
        try {
            await new Promise((resolve) => setTimeout(resolve, 1000))
            toast("Password reset email has been sent again.")
        } catch (error) {
            toast("Failed to resend email. Please try again.")
        } finally {
            setIsLoading(false)
        }
    }

    if (isEmailSent) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                            <Mail className="h-6 w-6 text-green-600" />
                        </div>
                        <CardTitle className="text-2xl font-bold">Check your email</CardTitle>
                        <CardDescription>
                            We've sent a password reset link to <span className="font-medium text-gray-900">{email}</span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="text-center text-sm text-gray-600">
                            {"Didn't receive the email? Check your spam folder or "}
                            <button
                                onClick={handleResendEmail}
                                disabled={isLoading}
                                className="text-blue-600 hover:text-blue-500 hover:underline disabled:opacity-50"
                            >
                                resend email
                            </button>
                        </div>
                        <Link href="/login">
                            <Button variant="outline" className="w-full bg-transparent">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to login
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold">Forgot Password</CardTitle>
                    <CardDescription>Enter your email address and we'll send you a link to reset your password</CardDescription>
                </CardHeader>
                <form onSubmit={handleForgotPassword}>
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
                        <div className="space-y-2">
                            <Label htmlFor="email">OTP</Label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter the otp"
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
                                    Sending...
                                </span>
                            ) : (
                                <span className="flex items-center">
                                    <Mail className="mr-2 h-4 w-4" />
                                    Reset Password
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
    )
}
