"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { fetchWithAuth } from "@/lib/fetchWithAuth"
import { istDateKey } from "@/lib/dailyTrack"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, FileText, Loader2 } from "lucide-react"
import { TrackerDatePicker } from "../_components/TrackerDatePicker"
import { TablePagination, usePagination } from "../_components/TablePagination"

interface MissingTask {
    id: string
    title: string
    priority: string
    dueDate: string | null
    clientName: string
    lastTrackedAt: string | null
}

interface AgentDailyTrackerResponse {
    date: string
    agent: { id: string; name: string; email: string }
    inProgress: number
    tasks: MissingTask[]
}

function formatDate(value: string | null) {
    if (!value) return "-"
    const d = new Date(value)
    if (isNaN(d.getTime())) return "-"
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Kolkata" })
}

export default function AgentDailyTrackerPage() {
    const router = useRouter()
    const { agentId } = useParams<{ agentId: string }>()
    const searchParams = useSearchParams()
    const date = searchParams.get("date") || istDateKey()
    const [data, setData] = useState<AgentDailyTrackerResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        setError(null)
        fetchWithAuth(`/api/daily-tracker/${agentId}?date=${encodeURIComponent(date)}`)
            .then(async (res) => {
                const body = await res.json()
                if (!res.ok) throw new Error(body.error || "Failed to load daily tracker")
                if (!cancelled) setData(body)
            })
            .catch((e) => {
                if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load daily tracker")
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [agentId, date])

    const pagination = usePagination(data?.tasks ?? [], date)

    const setDate = (value: string) => {
        if (value) router.replace(`/daily-tracker/${agentId}?date=${value}`)
    }

    return (
        <div className="w-full container mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-6 max-w-7xl space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-end">
                <div>
                    <Link href={`/daily-tracker?date=${date}`}>
                        <Button variant="ghost" className="px-0 mb-2 cursor-pointer">
                            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Daily Tracker
                        </Button>
                    </Link>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold break-words">
                        {data?.agent.name ?? "Agent"}
                    </h1>
                    <p className="text-sm sm:text-base text-muted-foreground mt-2">
                        {data?.agent.email}
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
                        <FileText className="h-5 w-5" />
                        Tasks without daily track
                        {data ? <Badge variant="destructive">{data.tasks.length}</Badge> : null}
                    </CardTitle>
                    <CardDescription>
                        {data
                            ? `${data.tasks.length} of ${data.inProgress} In Progress task(s) have no daily track for ${formatDate(data.date)}.`
                            : "In Progress tasks with no daily track for the selected date."}
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
                                        <TableHead>Task</TableHead>
                                        <TableHead>Client</TableHead>
                                        <TableHead>Priority</TableHead>
                                        <TableHead>Due Date</TableHead>
                                        <TableHead>Last daily track</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {!data || data.tasks.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                All In Progress tasks have a daily track for this date.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        pagination.pageRows.map((task) => (
                                            <TableRow
                                                key={task.id}
                                                className="cursor-pointer hover:bg-muted/50"
                                                onClick={() => router.push(`/task/${task.id}`)}
                                            >
                                                <TableCell className="font-medium max-w-64 truncate">{task.title}</TableCell>
                                                <TableCell className="max-w-48 truncate">{task.clientName || "-"}</TableCell>
                                                <TableCell>{task.priority}</TableCell>
                                                <TableCell>{formatDate(task.dueDate)}</TableCell>
                                                <TableCell>
                                                    {task.lastTrackedAt ? (
                                                        formatDate(task.lastTrackedAt)
                                                    ) : (
                                                        <span className="text-muted-foreground">Never</span>
                                                    )}
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
