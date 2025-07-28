'use client'
import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, RefreshCw, User, } from "lucide-react"
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

function Create({ admin }: any) {
    const [formData, setFormData] = useState({
        name: "",
        description: "",
    })

    // Handle form submission
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.name) {
            alert("Please fill in all required fields")
            return
        }
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold">
                    {admin ? "Edit Task Category" : "Create New Task Category"}
                </h1>
                <p className="text-muted-foreground mt-2">
                    {admin
                        ? "Edit category to organize your tasks effectively"
                        : "Add a new category to organize your tasks effectively."}
                </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5" />
                            Task Category Information
                        </CardTitle>
                        <CardDescription>Basic details about the category</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div >
                            <div className="space-y-2">
                                <Label htmlFor="username">Task Category *</Label>
                                <Input
                                    id="username"
                                    value={formData.name}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value }))}
                                    placeholder="Enter task category name"
                                    required
                                />
                            </div>
                            <div className="space-y-2 mt-3">
                                <Label htmlFor="email">Description *</Label>
                                <Textarea
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                                    placeholder="Enter category description (optional)"
                                    rows={4}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <div className="flex justify-end gap-4">
                    <Button
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
                        {admin ? "Update Cateory" : "Create Category"}
                    </Button>
                </div>
            </form>

        </div>
    )
}

export default Create
