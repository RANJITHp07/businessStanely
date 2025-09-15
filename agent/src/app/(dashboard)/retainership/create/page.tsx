'use client'
import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { User } from "lucide-react"
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useRouter } from "next/navigation"
import { toast } from "react-toastify"

interface CreateProps {
    admin?: {
        id: string;
        name?: string;
    } | null;
    initialData?: {
        id: string;
        name: string;
        description: string;
    };
}

function Create({ admin, initialData }: CreateProps) {
    const [formData, setFormData] = useState({
        name: initialData?.name || "",
        description: initialData?.description || "",
    })
    const [isSubmitting, setIsSubmitting] = useState(false)
    const router = useRouter()

    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.name) {
            toast.error("Retainership name is required")
            return
        }

        try {
            setIsSubmitting(true)
            // Determine if we're creating or updating
            const isEditing = !!admin?.id

            // Call API to create/update retainership
            const response = await fetch(
                isEditing ? `/api/retainerships/${admin.id}` : '/api/retainerships', 
                {
                    method: isEditing ? 'PUT' : 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(formData),
                }
            )
            
            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || `Failed to ${isEditing ? 'update' : 'create'} retainership`)
            }
            
            toast.success(`Retainership ${isEditing ? 'updated' : 'created'} successfully!`)
            // Use router for better navigation
            router.push('/retainership')
        } catch (error) {
            console.error("Error creating retainership:", error)
            const errorMessage = error instanceof Error ? error.message : "Failed to create retainership"
            toast.error(errorMessage)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold">
                    {admin ? "Edit Retainership" : "Create New Retainership"}
                </h1>
                <p className="text-muted-foreground mt-2">
                    {admin
                        ? "Edit retainership to organize your tasks effectively"
                        : "Add a new retainership to organize your tasks effectively."}
                </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5" />
                            Retainership Information
                        </CardTitle>
                        <CardDescription>Basic details about the retainership</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div >
                            <div className="space-y-2">
                                <Label htmlFor="username">Retainership *</Label>
                                <Input
                                    id="username"
                                    value={formData.name}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                                    placeholder="Enter retainership name"
                                    required
                                />
                            </div>
                            <div className="space-y-2 mt-3">
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                                    placeholder="Enter retainership description (optional)"
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
                        onClick={() => router.push('/retainership')}
                    >
                        Cancel
                    </Button>
                    <Button
                        className="cursor-pointer shadow-none hover:shadow-lg transition-shadow duration-300"
                        type="submit"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? "Processing..." : admin ? "Update Retainership" : "Create Retainership"}
                    </Button>
                </div>
            </form>

        </div>
    )
}

export default Create
