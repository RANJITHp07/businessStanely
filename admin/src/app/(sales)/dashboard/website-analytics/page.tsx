"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "react-toastify"
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip as RechartsTooltip,
    XAxis,
    YAxis,
} from "recharts"
import { ChartLine, ChevronLeft, ChevronRight, Eye, Loader2, RefreshCcw, Repeat, Users, CalendarDays } from "lucide-react"
import { fetchWithAuth } from "@/lib/fetchWithAuth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

/* Visits to the public website, recorded by its /api/track endpoint into the
   page_views collection and summarised by /api/website-analytics. Portal pages
   and bots are never recorded. IPs are shown masked (last part hidden); the
   full address is never stored. */

type Visit = {
    path: string
    referrer?: string | null
    utmSource?: string | null
    utmMedium?: string | null
    utmCampaign?: string | null
    maskedIp?: string | null
    country?: string | null
    region?: string | null
    city?: string | null
    device: string
    browser?: string | null
    os?: string | null
    createdAt: string
}

type AnalyticsData = {
    days: number
    totals: { views: number; visitors: number }
    daily: Array<{ date: string; views: number; visitors: number }>
    visits: Visit[]
    page: number
    pageSize: number
}

const RANGES = [
    { value: "1", label: "Last 24 hours" },
    { value: "7", label: "Last 7 days" },
    { value: "30", label: "Last 30 days" },
    { value: "90", label: "Last 90 days" },
    { value: "365", label: "Last 12 months" },
]

const formatDay = (date: string) =>
    new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })

const PAGE_SIZES = ["25", "50", "100"]

const formatTime = (iso: string) =>
    new Date(iso).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    })

function StatCard({ title, value, icon: Icon, hint }: { title: string; value: string; icon: any; hint: string }) {
    return (
        <Card>
            <CardContent className="p-5">
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">{title}</p>
                    <Icon className="h-4 w-4 text-blue-600" />
                </div>
                <p className="mt-2 text-2xl font-semibold">{value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
            </CardContent>
        </Card>
    )
}

export default function WebsiteAnalyticsPage() {
    const [days, setDays] = useState("7")
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState("25")
    const [data, setData] = useState<AnalyticsData | null>(null)
    const [loading, setLoading] = useState(true)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetchWithAuth(`/api/website-analytics?days=${days}&page=${page}&pageSize=${pageSize}`)
            if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Failed to load analytics")
            setData(await res.json())
        } catch (error: any) {
            if (error?.message !== "Unauthorized") toast.error(error?.message ?? "Failed to load analytics")
        } finally {
            setLoading(false)
        }
    }, [days, page, pageSize])

    useEffect(() => {
        load()
    }, [load])

    const totals = data?.totals ?? { views: 0, visitors: 0 }
    const today = data?.daily[data.daily.length - 1]
    const perVisitor = totals.visitors ? (totals.views / totals.visitors).toFixed(1) : "0"
    const totalPages = Math.max(1, Math.ceil(totals.views / Number(pageSize)))
    const firstRow = totals.views === 0 ? 0 : (page - 1) * Number(pageSize) + 1
    const lastRow = Math.min(page * Number(pageSize), totals.views)

    return (
        <div className="space-y-6 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <ChartLine className="h-6 w-6 text-blue-600" />
                    <div>
                        <h2 className="text-xl font-semibold">Website Analytics</h2>
                        <p className="text-sm text-muted-foreground">
                            Visits to legalstanley.in. Portal pages and bots are not counted.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Select
                        value={days}
                        onValueChange={(value) => {
                            setDays(value)
                            setPage(1)
                        }}
                    >
                        <SelectTrigger className="w-[170px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {RANGES.map((r) => (
                                <SelectItem key={r.value} value={r.value}>
                                    {r.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" onClick={load} disabled={loading} title="Refresh">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                    </Button>
                </div>
            </div>

            {loading && !data ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
            ) : (
                <>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <StatCard
                            title="Visitors"
                            value={totals.visitors.toLocaleString("en-IN")}
                            icon={Users}
                            hint="Unique per day; refreshes count once"
                        />
                        <StatCard
                            title="Page views"
                            value={totals.views.toLocaleString("en-IN")}
                            icon={Eye}
                            hint="Every page load, refreshes included"
                        />
                        <StatCard
                            title="Views per visitor"
                            value={perVisitor}
                            icon={Repeat}
                            hint="Page views ÷ visitors"
                        />
                        <StatCard
                            title="Today"
                            value={`${(today?.visitors ?? 0).toLocaleString("en-IN")} visitors`}
                            icon={CalendarDays}
                            hint={`${(today?.views ?? 0).toLocaleString("en-IN")} page views (India time)`}
                        />
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Visitors and page views</CardTitle>
                            <CardDescription>
                                Per day, India time · {RANGES.find((r) => r.value === days)?.label}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={280}>
                                <AreaChart data={data?.daily ?? []} margin={{ left: -10, right: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="date" tickFormatter={formatDay} tick={{ fontSize: 12 }} minTickGap={20} />
                                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                                    <RechartsTooltip labelFormatter={(label) => formatDay(String(label))} />
                                    <Area type="monotone" dataKey="views" name="Page views" stroke="#93c5fd" fill="#dbeafe" />
                                    <Area type="monotone" dataKey="visitors" name="Visitors" stroke="#2563eb" fill="#93c5fd" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>


                    <Card>
                        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                            <div>
                                <CardTitle className="text-base">Visits</CardTitle>
                                <CardDescription>
                                    Every page view in {RANGES.find((r) => r.value === days)?.label.toLowerCase()}, newest first.
                                    IPs are masked; the full address is never stored.
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span>Rows</span>
                                <Select
                                    value={pageSize}
                                    onValueChange={(value) => {
                                        setPageSize(value)
                                        setPage(1)
                                    }}
                                >
                                    <SelectTrigger className="h-8 w-[80px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PAGE_SIZES.map((size) => (
                                            <SelectItem key={size} value={size}>
                                                {size}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardHeader>
                        <CardContent className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Time</TableHead>
                                        <TableHead>Page</TableHead>
                                        <TableHead>Source</TableHead>
                                        <TableHead>Campaign</TableHead>
                                        <TableHead>Location</TableHead>
                                        <TableHead>Device</TableHead>
                                        <TableHead>Browser</TableHead>
                                        <TableHead>OS</TableHead>
                                        <TableHead>IP</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(data?.visits ?? []).length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                                                No visits in this period
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        data!.visits.map((visit, i) => (
                                            <TableRow key={`${visit.createdAt}-${i}`}>
                                                <TableCell className="whitespace-nowrap">{formatTime(visit.createdAt)}</TableCell>
                                                <TableCell className="max-w-[220px] truncate" title={visit.path}>{visit.path}</TableCell>
                                                <TableCell>{visit.referrer ?? "Direct"}</TableCell>
                                                <TableCell className="whitespace-nowrap">
                                                    {[visit.utmSource, visit.utmMedium, visit.utmCampaign].filter(Boolean).join(" / ") || "—"}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap">
                                                    {[visit.city, visit.region, visit.country].filter(Boolean).join(", ") || "Unknown"}
                                                </TableCell>
                                                <TableCell className="capitalize">{visit.device}</TableCell>
                                                <TableCell>{visit.browser ?? "—"}</TableCell>
                                                <TableCell>{visit.os ?? "—"}</TableCell>
                                                <TableCell className="whitespace-nowrap font-mono text-xs">
                                                    {visit.maskedIp ?? "—"}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                <span>
                                    {firstRow.toLocaleString("en-IN")}–{lastRow.toLocaleString("en-IN")} of{" "}
                                    {totals.views.toLocaleString("en-IN")}
                                </span>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage((p) => p - 1)}
                                        disabled={loading || page <= 1}
                                    >
                                        <ChevronLeft className="h-4 w-4" /> Previous
                                    </Button>
                                    <span>
                                        Page {page} of {totalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage((p) => p + 1)}
                                        disabled={loading || page >= totalPages}
                                    >
                                        Next <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    )
}
