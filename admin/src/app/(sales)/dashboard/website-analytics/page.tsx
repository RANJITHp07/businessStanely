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
import { ChartLine, Eye, Loader2, RefreshCcw, Repeat, Users, CalendarDays } from "lucide-react"
import { fetchWithAuth } from "@/lib/fetchWithAuth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

/* Visits to the public website, recorded by its /api/track endpoint into the
   page_views collection and summarised by /api/website-analytics. Portal pages
   and bots are never recorded. IPs are shown masked (last part hidden); the
   full address is never stored. */

type Bucket = { name: string; views: number; visitors: number }

type RecentVisit = {
    path: string
    referrer?: string | null
    utmSource?: string | null
    maskedIp?: string | null
    country?: string | null
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
    pages: Bucket[]
    referrers: Bucket[]
    campaigns: Bucket[]
    countries: Bucket[]
    cities: Bucket[]
    devices: Bucket[]
    browsers: Bucket[]
    os: Bucket[]
    recent: RecentVisit[]
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

/** Busiest-first list with a bar proportional to views. */
function BreakdownCard({ title, rows }: { title: string; rows: Bucket[] }) {
    const max = rows.reduce((m, r) => Math.max(m, r.views), 0) || 1
    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base">{title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                {rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No data yet</p>
                ) : (
                    <>
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span />
                            <span>Visitors · Views</span>
                        </div>
                        {rows.map((row) => (
                            <div key={row.name} className="relative overflow-hidden rounded">
                                <div
                                    className="absolute inset-y-0 left-0 bg-blue-100 dark:bg-blue-950"
                                    style={{ width: `${(row.views / max) * 100}%` }}
                                />
                                <div className="relative flex items-center justify-between gap-3 px-2 py-1.5 text-sm">
                                    <span className="truncate" title={row.name}>{row.name}</span>
                                    <span className="shrink-0 tabular-nums text-muted-foreground">
                                        {row.visitors.toLocaleString("en-IN")} · {row.views.toLocaleString("en-IN")}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </>
                )}
            </CardContent>
        </Card>
    )
}

export default function WebsiteAnalyticsPage() {
    const [days, setDays] = useState("30")
    const [data, setData] = useState<AnalyticsData | null>(null)
    const [loading, setLoading] = useState(true)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetchWithAuth(`/api/website-analytics?days=${days}`)
            if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Failed to load analytics")
            setData(await res.json())
        } catch (error: any) {
            if (error?.message !== "Unauthorized") toast.error(error?.message ?? "Failed to load analytics")
        } finally {
            setLoading(false)
        }
    }, [days])

    useEffect(() => {
        load()
    }, [load])

    const totals = data?.totals ?? { views: 0, visitors: 0 }
    const today = data?.daily[data.daily.length - 1]
    const perVisitor = totals.visitors ? (totals.views / totals.visitors).toFixed(1) : "0"

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
                    <Select value={days} onValueChange={setDays}>
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
                            <CardDescription>Per day, India time</CardDescription>
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

                    <div className="grid gap-4 lg:grid-cols-2">
                        <BreakdownCard title="Top pages" rows={data?.pages ?? []} />
                        <BreakdownCard title="Referrers" rows={data?.referrers ?? []} />
                        <BreakdownCard title="Campaigns (utm_source)" rows={data?.campaigns ?? []} />
                        <BreakdownCard title="Countries" rows={data?.countries ?? []} />
                        <BreakdownCard title="Cities" rows={data?.cities ?? []} />
                        <BreakdownCard title="Devices" rows={data?.devices ?? []} />
                        <BreakdownCard title="Browsers" rows={data?.browsers ?? []} />
                        <BreakdownCard title="Operating systems" rows={data?.os ?? []} />
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Recent visits</CardTitle>
                            <CardDescription>Latest 50 page views. IPs are masked; the full address is never stored.</CardDescription>
                        </CardHeader>
                        <CardContent className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Time</TableHead>
                                        <TableHead>Page</TableHead>
                                        <TableHead>Source</TableHead>
                                        <TableHead>Location</TableHead>
                                        <TableHead>Device</TableHead>
                                        <TableHead>IP</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(data?.recent ?? []).length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                                                No visits recorded yet
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        data!.recent.map((visit, i) => (
                                            <TableRow key={`${visit.createdAt}-${i}`}>
                                                <TableCell className="whitespace-nowrap">{formatTime(visit.createdAt)}</TableCell>
                                                <TableCell className="max-w-[220px] truncate">{visit.path}</TableCell>
                                                <TableCell>{visit.utmSource ?? visit.referrer ?? "Direct"}</TableCell>
                                                <TableCell className="whitespace-nowrap">
                                                    {[visit.city, visit.country].filter(Boolean).join(", ") || "Unknown"}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap capitalize">
                                                    {[visit.device, visit.browser, visit.os].filter(Boolean).join(" · ")}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap font-mono text-xs">
                                                    {visit.maskedIp ?? "—"}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    )
}
