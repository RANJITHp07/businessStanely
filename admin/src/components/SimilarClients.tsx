"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Building2, User } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { fetchWithAuth } from "@/lib/fetchWithAuth"
import { clientDisplayName } from "@/lib/entityNames"

export interface SimilarClient {
    id: string
    clientType: string
    firstName?: string | null
    lastName?: string | null
    organizationName?: string | null
    email: string
    phoneNumber: string
}

interface SimilarClientsProps {
    /** The name being typed into the create form. */
    name: string
    onSelect: (client: SimilarClient) => void
    selectLabel?: string
}

/**
 * Lists already-registered clients whose name resembles `name`, marked
 * "(regd)", so the user can pick the existing record and abandon creating a
 * duplicate. Renders nothing until there is a match.
 */
export default function SimilarClients({ name, onSelect, selectLabel = "Select" }: SimilarClientsProps) {
    const [matches, setMatches] = useState<SimilarClient[]>([])

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
                const response = await fetchWithAuth(`/api/clients/similar?name=${encodeURIComponent(query)}`)
                const data = response.ok ? await response.json() : []
                if (!stale) setMatches(Array.isArray(data) ? data : [])
            } catch (error) {
                console.error("Error checking for similar clients:", error)
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
                    {matches.length === 1 ? "A client with a similar name is" : "Clients with a similar name are"} already
                    registered. Select one instead of creating a duplicate.
                </span>
            </div>
            <div className="rounded-md border border-gray-200 bg-white max-h-60 overflow-auto">
                {matches.map((client) => (
                    <div
                        key={client.id}
                        className="flex items-center justify-between gap-3 p-3 border-b border-gray-100 last:border-b-0"
                    >
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium truncate">{clientDisplayName(client)}</span>
                                <Badge className="text-xs bg-green-100 text-green-800 border border-green-200">(regd)</Badge>
                                <Badge variant="outline" className="text-xs">
                                    {client.clientType === "organization" ? (
                                        <Building2 className="w-3 h-3 mr-1" />
                                    ) : (
                                        <User className="w-3 h-3 mr-1" />
                                    )}
                                    {client.clientType === "organization" ? "Organization" : "Individual"}
                                </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 truncate">
                                {[client.email, client.phoneNumber].filter(Boolean).join(" · ")}
                            </div>
                        </div>
                        <Button type="button" size="sm" variant="outline" onClick={() => onSelect(client)}>
                            {selectLabel}
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    )
}
