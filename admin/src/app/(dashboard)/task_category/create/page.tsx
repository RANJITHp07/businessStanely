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
        timePeriod?: number;
        notes?: string;
        processFlow?: string;
        agentCanEditDays?: boolean;
    };
}

function Create({ admin, initialData }: CreateProps) {
    const [formData, setFormData] = useState({
        name: initialData?.name || "",
        description: initialData?.description || "",
        timePeriod: initialData?.timePeriod !== undefined && initialData?.timePeriod !== null ? String(initialData.timePeriod) : "",
        notes: initialData?.notes || "",
        processFlow: initialData?.processFlow || "",
        agentCanEditDays: initialData?.agentCanEditDays ?? false,
    })
    const [isSubmitting, setIsSubmitting] = useState(false)
    const router = useRouter()

    // ...existing code...
    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.name) {
            toast.error("Service name is required")
            return
        }

        try {
            setIsSubmitting(true)
            // Determine if we're creating or updating
            const isEditing = !!admin?.id

            // Call API to create/update category
            const response = await fetch(
                isEditing ? `/api/task-categories/${admin.id}` : '/api/task-categories',
                {
                    method: isEditing ? 'PUT' : 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ ...formData, timePeriod: parseInt(formData.timePeriod, 10), agentCanEditDays: formData.agentCanEditDays }), // Ensure timePeriod is sent as a number and include agentCanEditDays
                }
            )

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || `Failed to ${isEditing ? 'update' : 'create'} category`)
            }

            toast.success(`Category ${isEditing ? 'updated' : 'created'} successfully!`)
            // Use router for better navigation
            router.push('/task_category')
        } catch (error) {
            console.error("Error creating category:", error)
            const errorMessage = error instanceof Error ? error.message : "Failed to create category"
            toast.error(errorMessage)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold">
                    {admin ? "Edit Service" : "Create New Service"}
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
                            Service Information
                        </CardTitle>
                        <CardDescription>Basic details about the category</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div >
                            <div className="space-y-2">
                                <Label htmlFor="username">Service *</Label>
                                <Input
                                    id="username"
                                    value={formData.name}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                                    placeholder="Enter service name"
                                    required
                                />
                            </div>
                            <div className="space-y-2 mt-3">
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                                    placeholder="Enter service description (optional)"
                                    rows={4}
                                />
                            </div>
                            <div className="space-y-2 mt-3">
                                <Label htmlFor="timePeriod">Time Period (in days)</Label>
                                <Input
                                    id="timePeriod"
                                    type="number"
                                    value={formData.timePeriod}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, timePeriod: e.target.value }))}
                                    placeholder="Enter time period in days"
                                />
                            </div>
                            <div className="space-y-2 mt-3">
                                <Label htmlFor="notes">Notes</Label>
                                <Textarea
                                    id="notes"
                                    value={formData.notes}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                                    placeholder="Enter notes (optional)"
                                    rows={2}
                                />
                            </div>
                            <div className="space-y-2 mt-3">
                                <Label htmlFor="processFlow">Process Flow</Label>
                                <Textarea
                                    id="processFlow"
                                    value={formData.processFlow}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, processFlow: e.target.value }))}
                                    placeholder="Enter process flow (optional)"
                                    rows={2}
                                />
                            </div>
                            <div className="flex items-center mt-4">
                                <input
                                    id="agentCanEditDays"
                                    type="checkbox"
                                    checked={formData.agentCanEditDays}
                                    onChange={e => setFormData(prev => ({ ...prev, agentCanEditDays: e.target.checked }))}
                                    className="mr-2"
                                />
                                <Label htmlFor="agentCanEditDays" className="cursor-pointer">
                                    Check to allow agents to edit days; uncheck to lock.
                                </Label>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <div className="flex justify-end gap-4">
                    <Button
                        className="bg-[#f42b03] hover:bg-[#f42b03] shadow-none hover:shadow-lg transition-shadow duration-300 text-white hover:text-white cursor-pointer"
                        type="button"
                        variant="outline"
                        onClick={() => router.push('/task_category')}
                    >
                        Cancel
                    </Button>
                    <Button
                        className="cursor-pointer shadow-none hover:shadow-lg transition-shadow duration-300"
                        type="submit"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? "Processing..." : admin ? "Update Service" : "Create Service"}
                    </Button>
                </div>
            </form>

        </div>
    )
}

export default Create
