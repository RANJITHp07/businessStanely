"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "react-toastify"
import { fetchWithAuth } from "@/lib/fetchWithAuth"
import { Skeleton } from "@/components/ui/skeleton"
import PracticeAreaForm, {
    type ParameterDraft,
    type PracticeAreaFormValues,
} from "../../_components/PracticeAreaForm"

export default function EditPracticeArea() {
    const { id } = useParams<{ id: string }>()
    const router = useRouter()
    const [initial, setInitial] = useState<PracticeAreaFormValues | null>(null)

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetchWithAuth(`/api/practice-areas/${id}`)
                if (!res.ok) throw new Error()
                const data = await res.json()
                setInitial({
                    title: data.title || "",
                    description: data.description || "",
                    icon: data.icon || "building",
                    active: data.active !== false,
                    parameters: (data.parameters ?? []).map(
                        (p: ParameterDraft): ParameterDraft => ({
                            key: p.id as string,
                            id: p.id,
                            usageCount: p.usageCount ?? 0,
                            title: p.title,
                            type: p.type,
                            required: p.required,
                            options: p.options ?? [],
                            attachmentMode: p.attachmentMode,
                            maxAttachments: p.maxAttachments ?? null,
                        }),
                    ),
                })
            } catch {
                toast.error("Failed to load parameter area")
                router.push("/practice-areas")
            }
        }
        load()
    }, [id, router])

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold">Edit Parameter Area</h1>
                <p className="text-muted-foreground mt-2">
                    Update how this service appears on the website and the details clients fill in for it.
                </p>
            </div>
            {initial ? (
                <PracticeAreaForm id={id} initial={initial} />
            ) : (
                <div className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-10 w-72" />
                </div>
            )}
        </div>
    )
}
