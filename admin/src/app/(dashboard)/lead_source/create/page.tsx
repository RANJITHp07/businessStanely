"use client"

import type React from "react"
import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { BookmarkPlus } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { toast } from "react-toastify"

export default function CreateLeadSource() {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [formData, setFormData] = useState({
        name: "",
        description: "",
    })
    const router = useRouter()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.name) {
            return
        }

        try {
            setIsSubmitting(true)
            const response = await fetch("/api/lead_source", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(formData),
            })

            if (response.ok) {
                toast.success("Lead source created successfully")
                router.push("/lead_source")
            } else {
                const error = await response.json()
                toast.error(error.message || "Something went wrong")
            }
        } catch (error) {
            setIsSubmitting(false)
            toast.error("An unexpected error occurred")
        }
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold">Create New Lead Source</h1>
                <p className="text-muted-foreground mt-2">Add a new lead source to track where your prospects come from.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BookmarkPlus className="h-5 w-5" />
                            Lead Source Information
                        </CardTitle>
                        <CardDescription>Basic details about the lead source</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Name *</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                                placeholder="Enter lead source name (e.g., Website, Referral)"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                                placeholder="Enter optional description about this lead source"
                                rows={4}
                            />
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-end gap-4">
                    <Button
                        onClick={() => router.push("/lead_source")}
                        className="bg-[#f42b03] hover:bg-[#f42b03] shadow-none hover:shadow-lg transition-shadow duration-300 text-white hover:text-white cursor-pointer"
                        type="button"
                        variant="outline"
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        disabled={isSubmitting}
                        className="cursor-pointer shadow-none hover:shadow-lg transition-shadow duration-300" type="submit">
                        {isSubmitting ? "Creating..." : "Create Lead Source"}
                    </Button>
                </div>
            </form >
        </div >
    )
}
