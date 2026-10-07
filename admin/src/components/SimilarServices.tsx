"use client"

import { useEffect, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { fetchWithAuth } from "@/lib/fetchWithAuth"

export interface SimilarService {
    id: string
    name: string
    description?: string | null
    status: string
    timePeriod?: number | null
}

interface SimilarServicesProps {
    /** The name being typed into the create form. */
    name: string
    onSelect: (service: SimilarService) => void
    selectLabel?: string
}

/**
 * Lists existing services whose name resembles `name`, marked with their
 * approval state, so the user can pick the existing service and abandon
 * creating a duplicate. Renders nothing until there is a match.
 */
export default function SimilarServices({ name, onSelect, selectLabel = "Select" }: SimilarServicesProps) {
    const [matches, setMatches] = useState<SimilarService[]>([])

    useEffect(() => {
        const query = name.trim()
        if (query.length < 2) {
            setMatches([])
            return
        }

        // Debounced so a lookup runs once typing pauses, and the cleanup flag
        // drops a slow response that arrives after the name has changed again.
        let stale = false
        const timer = setTimeout(async () => {
            try {
                const response = await fetchWithAuth(`/api/task-categories/similar?name=${encodeURIComponent(query)}`)
                const data = response.ok ? await response.json() : []
                if (!stale) setMatches(Array.isArray(data) ? data : [])
            } catch (error) {
                console.error("Error checking for similar services:", error)
                if (!stale) setMatches([])
            }
        }, 350)

        return () => {
            stale = true
            clearTimeout(timer)
        }
    }, [name])

    if (matches.length === 0) return null

    return (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-2">
            <div className="flex items-start gap-2 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>
                    {matches.length === 1 ? "A service with a similar name" : "Services with a similar name"} already
                    exist. Select one instead of creating a duplicate.
                </span>
            </div>
            <div className="rounded-md border border-gray-200 bg-white max-h-60 overflow-auto">
                {matches.map((service) => (
                    <div
                        key={service.id}
                        className="flex items-center justify-between gap-3 p-3 border-b border-gray-100 last:border-b-0"
                    >
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium truncate">{service.name}</span>
                                {service.status === "approved" ? (
                                    <Badge className="text-xs bg-green-100 text-green-800 border border-green-200">(Approved)</Badge>
                                ) : (
                                    <Badge className="text-xs bg-yellow-100 text-yellow-800 border border-yellow-200">(Pending approval)</Badge>
                                )}
                            </div>
                            {service.description && (
                                <div className="text-xs text-muted-foreground mt-1 truncate">{service.description}</div>
                            )}
                        </div>
                        <Button type="button" size="sm" variant="outline" onClick={() => onSelect(service)}>
                            {selectLabel}
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    )
}
