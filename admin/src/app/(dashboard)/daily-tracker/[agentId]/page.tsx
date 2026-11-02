"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { fetchWithAuth } from "@/lib/fetchWithAuth"
import { istDateKey } from "@/lib/dailyTrack"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ArrowLeft, FileText, Loader2 } from "lucide-react"
import { TrackerDatePicker } from "../_components/TrackerDatePicker"
import { TablePagination, usePagination } from "../_components/TablePagination"

interface TrackerTask {
    id: string
    title: string
    dueDate: string | null
    clientName: string
}

interface CompletedTask extends TrackerTask {
    note: { content: string; createdAt: string; updatedAt: string }
}

interface NotCompletedTask extends TrackerTask {
    lastTrackedAt: string | null
}

interface AgentDailyTrackerResponse {
    date: string
    agent: { id: string; name: string; email: string }
    inProgress: number
    completed: CompletedTask[]
    notCompleted: NotCompletedTask[]
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
    }, [agentId, date])

    const completedPages = usePagination(data?.completed ?? [], date)
    const notCompletedPages = usePagination(data?.notCompleted ?? [], date)

    const setDate = (value: string) => {
        if (value) router.replace(`/daily-tracker/${agentId}?date=${value}`)
    }

    return (
        <div className="w-full container mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-6 max-w-7xl space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-end">
                <div>
                    <Link href={`/daily-tracker?date=${date}`}>
                        <Button variant="ghost" className="px-0 mb-2 cursor-pointer">
                            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Day Tracker
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
                        In Progress tasks
                    </CardTitle>
                    <CardDescription>
                        {data
                            ? `${data.completed.length} of ${data.inProgress} In Progress task(s) have a day track for ${formatDate(data.date)}.`
                            : "Day track status of In Progress tasks for the selected date."}
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
                        <Tabs defaultValue="notCompleted" className="space-y-4">
                            <TabsList className="grid w-full max-w-md grid-cols-2">
                                <TabsTrigger value="completed">
                                    Completed ({data?.completed.length ?? 0})
                                </TabsTrigger>
                                <TabsTrigger value="notCompleted">
                                    Not Completed ({data?.notCompleted.length ?? 0})
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="completed">
                                <div className="rounded-md border overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Task</TableHead>
                                                <TableHead>Client</TableHead>
                                                <TableHead>Due Date</TableHead>
                                                <TableHead>Comment</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {completedPages.total === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                                        No tasks have a day track for this date.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                completedPages.pageRows.map((task) => (
                                                    <TableRow
                                                        key={task.id}
                                                        className="cursor-pointer hover:bg-muted/50"
                                                        onClick={() => router.push(`/task/${task.id}`)}
                                                    >
                                                        <TableCell className="font-medium max-w-64 truncate">{task.title}</TableCell>
                                                        <TableCell className="max-w-48 truncate">{task.clientName || "-"}</TableCell>
                                                        <TableCell>{formatDate(task.dueDate)}</TableCell>
                                                        <TableCell className="max-w-72">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <p className="truncate">{task.note.content}</p>
                                                                </TooltipTrigger>
                                                                <TooltipContent className="max-w-md whitespace-pre-wrap">
                                                                    {task.note.content}
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                    <div className="px-4">
                                        <TablePagination {...completedPages} />
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="notCompleted">
                                <div className="rounded-md border overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Task</TableHead>
                                                <TableHead>Client</TableHead>
                                                <TableHead>Due Date</TableHead>
                                                <TableHead>Last day track</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {notCompletedPages.total === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                                        All In Progress tasks have a day track for this date.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                notCompletedPages.pageRows.map((task) => (
                                                    <TableRow
                                                        key={task.id}
                                                        className="cursor-pointer hover:bg-muted/50"
                                                        onClick={() => router.push(`/task/${task.id}`)}
                                                    >
                                                        <TableCell className="font-medium max-w-64 truncate">{task.title}</TableCell>
                                                        <TableCell className="max-w-48 truncate">{task.clientName || "-"}</TableCell>
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
                                        <TablePagination {...notCompletedPages} />
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
