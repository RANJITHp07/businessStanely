"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { BookmarkPlus } from "lucide-react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { toast } from "react-toastify"
import { Skeleton } from "@/components/ui/skeleton"

export default function EditLeadSource() {
    const { id } = useParams<{ id: string }>()
    const router = useRouter()

    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [formData, setFormData] = useState({
        name: "",
        description: "",
    })

    useEffect(() => {
        const fetchLeadSource = async () => {
            try {
                const res = await fetch(`/api/lead_source/${id}`)
                if (!res.ok) throw new Error()

                const data = await res.json()
                setFormData({
                    name: data.name || "",
                    description: data.description || "",
                })
            } catch {
                toast.error("Failed to load lead source")
                router.push("/lead_source")
            } finally {
                setIsLoading(false)
            }
        }

        fetchLeadSource()
    }, [id, router])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.name) return

        try {
            setIsSubmitting(true)

            const response = await fetch(`/api/lead_source/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(formData),
            })

            if (response.ok) {
                toast.success("Lead source updated successfully")
                router.push("/lead_source")
            } else {
                const error = await response.json()
                toast.error(error.message || "Something went wrong")
            }
        } catch {
            toast.error("An unexpected error occurred")
        } finally {
            setIsSubmitting(false)
        }
    }

    if (isLoading) {
        return (
            <div className="container mx-auto p-6 max-w-7xl">
                {/* Header Skeleton */}
                <div className="mb-8">
                    <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 md:mb-4">
                        <div>
                            <Skeleton className="h-8 w-40 mb-2" />
                            <Skeleton className="h-5 w-80" />
                        </div>
                    </div>
                    <Card>
                        <CardContent className="p-6">
                            <div className="space-y-4">
                                <Skeleton className="h-6 w-1/2 mb-2" />
                                <Skeleton className="h-4 w-full mb-4" />
                                <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 p-0 md:p-4 bg-muted/30 rounded-lg">
                                    <Skeleton className="h-4 w-32" />
                                    <Skeleton className="h-4 w-32" />
                                    <Skeleton className="h-4 w-40 md:ml-auto" />
                                </div>
                            </div>

                        </CardContent>

                    </Card>


                </div>


            </div>
        );

    }

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold">Edit Lead Source</h1>
                <p className="text-muted-foreground mt-2">
                    Update the details of this lead source.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BookmarkPlus className="h-5 w-5" />
                            Lead Source Information
                        </CardTitle>
                        <CardDescription>
                            Modify basic details about the lead source
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Name *</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        name: e.target.value,
                                    }))
                                }
                                placeholder="Enter lead source name"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        description: e.target.value,
                                    }))
                                }
                                placeholder="Enter optional description"
                                rows={4}
                            />
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-end gap-4">
                    <Button
                        type="button"
                        variant="outline"
                        disabled={isSubmitting}
                        onClick={() => router.push("/lead_source")}
                        className="bg-[#f42b03] hover:bg-[#f42b03] text-white"
                    >
                        Cancel
                    </Button>

                    <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="shadow-none hover:shadow-lg transition-shadow"
                    >
                        {isSubmitting ? "Updating..." : "Update Lead Source"}
                    </Button>
                </div>
            </form>
        </div>
    )
}
