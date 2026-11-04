"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { fetchWithAuth } from "@/lib/fetchWithAuth"
import { istDateKey } from "@/lib/dailyTrack"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ClipboardCheck, Loader2 } from "lucide-react"
import { TrackerDatePicker } from "./_components/TrackerDatePicker"
import { TablePagination, usePagination } from "./_components/TablePagination"

interface MissingAgentRow {
    id: string
    name: string
    email: string
    tracked: number
    inProgress: number
    retainershipTracked: number
    retainershipInProgress: number
}

function TrackedBadge({ tracked, total }: { tracked: number; total: number }) {
    if (total === 0) return <span className="text-muted-foreground">-</span>
    return (
        <Badge variant={tracked === total ? "secondary" : "destructive"}>
            {tracked}/{total}
        </Badge>
    )
}

interface DailyTrackerResponse {
    date: string
    agents: MissingAgentRow[]
    totalTracked: number
    totalInProgress: number
    totalRetainershipTracked: number
    totalRetainershipInProgress: number
}

export default function DailyTrackerPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const date = searchParams.get("date") || istDateKey()
    const [data, setData] = useState<DailyTrackerResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        setError(null)
        fetchWithAuth(`/api/daily-tracker?date=${encodeURIComponent(date)}`)
            .then(async (res) => {
                const body = await res.json()
                if (!res.ok) throw new Error(body.error || "Failed to load day tracker")
                if (!cancelled) setData(body)
            })
            .catch((e) => {
                if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load day tracker")
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [date])

    const pagination = usePagination(data?.agents ?? [], date)

    const setDate = (value: string) => {
        if (value) router.replace(`/daily-tracker?date=${value}`)
    }

    return (
        <div className="w-full container mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-6 max-w-7xl space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-end">
                <div>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold break-words">Day Tracker</h1>
                    <p className="text-sm sm:text-base text-muted-foreground mt-2">
                        Day track status of each agent on their In Progress tasks
                    </p>
                </div>
                <div className="space-y-2 w-full md:w-48">
                    <Label>Date</Label>
                    <TrackerDatePicker value={date} onChange={setDate} />
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ClipboardCheck className="h-5 w-5" />
                        Agents
                        {data ? <Badge variant="secondary">{data.agents.length}</Badge> : null}
                    </CardTitle>
                    <CardDescription>
                        {data
                            ? `${data.totalTracked} of ${data.totalInProgress} In Progress task(s) and ${data.totalRetainershipTracked} of ${data.totalRetainershipInProgress} retainership task(s) have a day track. Click an agent to see the tasks.`
                            : "Click an agent to see the tasks."}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center items-center py-12 text-muted-foreground">
                            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading...
                        </div>
                    ) : error ? (
                        <p className="text-center py-12 text-red-600">{error}</p>
                    ) : (
                        <div className="rounded-md border overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Agent</TableHead>
                                        <TableHead className="text-right">Tasks</TableHead>
                                        <TableHead className="text-right">Retainership</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {!data || data.agents.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                                No agents have In Progress tasks for this date.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        pagination.pageRows.map((agent) => (
                                            <TableRow
                                                key={agent.id}
                                                className="cursor-pointer hover:bg-muted/50"
                                                onClick={() => router.push(`/daily-tracker/${agent.id}?date=${data.date}`)}
                                            >
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-8 w-8">
                                                            <AvatarFallback className="text-xs">
                                                                {agent.name
                                                                    .split(" ")
                                                                    .map((n) => n[0])
                                                                    .join("")
                                                                    .toUpperCase()}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="min-w-0">
                                                            <div className="font-medium truncate">{agent.name}</div>
                                                            <div className="text-xs text-muted-foreground truncate">{agent.email}</div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <TrackedBadge tracked={agent.tracked} total={agent.inProgress} />
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <TrackedBadge tracked={agent.retainershipTracked} total={agent.retainershipInProgress} />
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                            <div className="px-4">
                                <TablePagination {...pagination} />
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
