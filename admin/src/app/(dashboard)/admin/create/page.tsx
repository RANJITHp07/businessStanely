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


    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.username || !formData.email || (!admin && !formData.password)) {
            toast.error("Please fill in all required fields")
            return
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
                    email: formData.email,
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
                                <Input
                                    id="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                                    placeholder="Enter email address"
                                    required
                                />
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
