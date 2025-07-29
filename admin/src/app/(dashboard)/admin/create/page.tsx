'use client'
import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Eye, EyeOff, RefreshCw, User, Shield } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "react-toastify"
import { Button } from '@/components/ui/button'

export interface Admin {
    id?: string;
    username: string;
    email: string;
    adminType: "owner" | "admin";
}

interface CreateProps {
    admin?: Admin;
}
function Create({ admin }: CreateProps) {
    const [formData, setFormData] = useState({
        username: admin?.username || "",
        email: admin?.email || "",
        password: "",
        adminType: admin?.adminType || "admin",
    })
    const [showPassword, setShowPassword] = useState(false)
    const [emailError, setEmailError] = useState<string | null>(null)
    const [isCheckingEmail, setIsCheckingEmail] = useState(false)
    const router = useRouter()
    
    // Check if the current user is an owner
    useEffect(() => {
        const userStr = localStorage.getItem("user")
        if (userStr) {
            try {
                const user = JSON.parse(userStr)
                if (user.adminType !== "owner") {
                    // Redirect non-owner users away from this page
                    toast.error("Only owners can create or edit admins")
                    router.push("/admin")
                }
            } catch (error) {
                console.error("Error parsing user data:", error)
                router.push("/admin")
            }
        } else {
            // If user data is not available, redirect to admin page
            router.push("/admin")
        }
    }, [router])


    const generatePassword = () => {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*"
        let password = ""
        for (let i = 0; i < 12; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        setFormData((prev) => ({ ...prev, password }))
    }
    
    // Check if email already exists
    const checkEmailExists = async (email: string) => {
        if (!email || admin) return // Don't check if editing or email is empty
        
        try {
            setIsCheckingEmail(true)
            setEmailError(null)
            
            // Add a small delay to prevent too many requests while typing
            await new Promise(resolve => setTimeout(resolve, 500))
            
            // Check email validity first
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            if (!emailRegex.test(email)) {
                setEmailError("Please enter a valid email address")
                return
            }
            
            const response = await fetch(`/api/admins/check-email?email=${encodeURIComponent(email)}`)
            const data = await response.json()
            
            if (data.exists) {
                setEmailError("This email is already in use")
            } else {
                setEmailError(null)
            }
        } catch (error) {
            console.error("Error checking email:", error)
            // Don't set error here - it's better not to block the user if this check fails
        } finally {
            setIsCheckingEmail(false)
        }
    }


    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        // When creating a new admin, require all fields
        // When editing, only require username and adminType
        if (!formData.username || 
            (!admin && !formData.email) || 
            (!admin && !formData.password)) {
            toast.error("Please fill in all required fields")
            return
        }
        
        // Check for email errors before submitting
        if (!admin && emailError) {
            toast.error("Please fix the email error before submitting")
            return
        }
        
        // For new admin creation, do a final check of the email
        if (!admin) {
            setIsCheckingEmail(true)
            try {
                const response = await fetch(`/api/admins/check-email?email=${encodeURIComponent(formData.email)}`)
                const data = await response.json()
                
                if (data.exists) {
                    setEmailError("This email is already in use")
                    toast.error("Email is already in use. Please use a different email.")
                    setIsCheckingEmail(false)
                    return
                }
            } catch (error) {
                console.error("Error checking email:", error)
                // Continue with form submission even if this check fails
            }
            setIsCheckingEmail(false)
        }

        try {
            const url = admin 
                ? `/api/admins/${admin.id}` 
                : "/api/auth/create-admin"
            
            const response = await fetch(url, {
                method: admin ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    username: formData.username,
                    // Only include email when creating a new admin, not when updating
                    ...(admin ? {} : { email: formData.email }),
                    ...(formData.password ? { password: formData.password } : {}),
                    adminType: formData.adminType
                }),
            });

            if (response.ok) {
                toast.success(`Admin ${admin ? "updated" : "created"} successfully`);
                router.push("/admin");
            } else {
                const error = await response.json();
                toast.error(error.message || "Something went wrong");
            }
        } catch (error) {
            console.error("Error:", error);
            toast.error("An unexpected error occurred");
        }
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold">
                    {admin ? "Edit Admin" : "Create New Admin"}
                </h1>
                <p className="text-muted-foreground mt-2">
                    {admin
                        ? "Update the admin's details and assignments."
                        : "Add a new admin to your organization with their details."}
                </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5" />
                            Personal Information
                        </CardTitle>
                        <CardDescription>Basic details about the admin</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="username">Username *</Label>
                                <Input
                                    id="username"
                                    value={formData.username}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value }))}
                                    placeholder="Enter username"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email *</Label>
                                <div className="relative">
                                    <Input
                                        id="email"
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => {
                                            const newEmail = e.target.value;
                                            setFormData((prev) => ({ ...prev, email: newEmail }));
                                            if (newEmail.includes('@') && newEmail.includes('.')) {
                                                checkEmailExists(newEmail);
                                            }
                                        }}
                                        onBlur={() => formData.email && checkEmailExists(formData.email)}
                                        placeholder="Enter email address"
                                        required
                                        disabled={!!admin} // Disable email field when editing an admin
                                        title={admin ? "Email cannot be changed after creation" : ""}
                                        className={emailError ? "border-red-500" : ""}
                                    />
                                    {isCheckingEmail && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <RefreshCw className="h-4 w-4 animate-spin text-gray-400" />
                                        </div>
                                    )}
                                </div>
                                {admin && (
                                    <p className="text-xs text-muted-foreground mt-1">Email cannot be changed after admin creation</p>
                                )}
                                {!admin && emailError && (
                                    <p className="text-xs text-red-500 mt-1">{emailError}</p>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2 mt-3">
                            <Label htmlFor="adminType">Admin Type</Label>
                            <Select
                                value={formData.adminType}
                                onValueChange={(value: "owner" | "admin") => setFormData((prev) => ({ ...prev, adminType: value }))}
                            >
                                <SelectTrigger className='w-full'>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="owner">
                                        <div className="flex items-center">
                                            <Shield className="w-4 h-4 mr-2" />
                                            Owner
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="admin">
                                        <div className="flex items-center">
                                            <User className="w-4 h-4 mr-2" />
                                            Admin
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">
                                Password {admin ? "(Leave blank to keep current password)" : "*"}
                            </Label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        value={formData.password}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                                        placeholder={admin ? "Leave blank to keep current password" : "Enter password"}
                                        required={!admin}
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="absolute right-0 top-0 h-full px-3"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={generatePassword}
                                    className="flex items-center gap-2 bg-transparent"
                                >
                                    <RefreshCw className="h-4 w-4" />
                                    Generate
                                </Button>
                            </div>
                        </div>

                    </CardContent>
                </Card>
                <div className="flex justify-end gap-4">
                    <Button
                        onClick={() => router.push("/admin")}
                        className="bg-[#f42b03] hover:bg-[#f42b03] shadow-none hover:shadow-lg transition-shadow duration-300 text-white hover:text-white cursor-pointer"
                        type="button"
                        variant="outline"
                    >
                        Cancel
                    </Button>
                    <Button
                        className=" cursor-pointer shadow-none hover:shadow-lg transition-shadow duration-300"
                        type="submit"
                    >
                        {admin ? "Update Admin" : "Create Admin"}
                    </Button>
                </div>
            </form>

        </div>
    )
}

export default Create
