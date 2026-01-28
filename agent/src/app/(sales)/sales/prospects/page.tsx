"use client"
import type React from "react"
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ClipboardList, Loader2, Clock, Eye, Calendar, Plus } from "lucide-react"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import { Progress } from "@/components/ui/progress"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { normalizePhoneNumber } from "@/lib/normalizePhoneNumber"

// Mock data type for prospects
interface Prospect {
    id: string
    name: string
    phoneNumber: string
    description: string
    nextFollowUp?: string
    status: string
    archived?: boolean
}

function formatDate(dateString?: string) {
    if (!dateString) return "N/A"
    const d = new Date(dateString)
    if (isNaN(d.getTime())) return "N/A"
    return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    })
}

type StatVariant = "total" | "new" | "inprogress"

const STAT_STYLES: Record<
    StatVariant,
    {
        bar: string
        iconWrap: string
        value: string
        title: string
        light: string
        indicator: string
    }
> = {
    total: {
        bar: "bg-blue-500",
        iconWrap: "text-blue-700 bg-blue-100",
        value: "text-blue-800",
        title: "text-blue-800",
        light: "bg-blue-50",
        indicator: "[&_[data-slot=progress-indicator]]:bg-blue-500",
    },
    new: {
        bar: "bg-green-500",
        iconWrap: "text-green-700 bg-green-100",
        value: "text-green-800",
        title: "text-green-800",
        light: "bg-green-50",
        indicator: "[&_[data-slot=progress-indicator]]:bg-green-500",
    },
    inprogress: {
        bar: "bg-sky-500",
        iconWrap: "text-sky-700 bg-sky-100",
        value: "text-sky-800",
        title: "text-sky-800",
        light: "bg-sky-50",
        indicator: "[&_[data-slot=progress-indicator]]:bg-sky-500",
    },
}

function StatCard({
    title,
    value,
    percent,
    Icon,
    variant,
}: {
    title: string
    value: number
    percent: number
    Icon: React.ComponentType<{ className?: string }>
    variant: StatVariant
}) {
    const s = STAT_STYLES[variant]
    return (
        <Card className="relative overflow-hidden border border-border">
            <span className={`absolute inset-x-0 top-0 h-1 ${s.bar}`} />
            <CardHeader className="pb-1">
                <div className="flex items-center justify-between">
                    <CardTitle className={`text-sm font-semibold ${s.title}`}>{title}</CardTitle>
                    <div className={`rounded-full p-2 ${s.iconWrap}`}>
                        <Icon className="h-5 w-5" />
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-2">
                <div className="flex items-baseline justify-between">
                    <div className={`text-4xl leading-none font-bold ${s.value}`}>{value}</div>
                    <div className="text-xs font-medium text-muted-foreground">{percent}%</div>
                </div>
                <Progress value={percent} className={`${s.light} ${s.indicator}`} />
            </CardContent>
        </Card>
    )
}

function SectionTable({ label, prospects }: { label: string; prospects: Prospect[] }) {
    const router = useRouter()
    const labelColor = (() => {
        const l = label.toLowerCase()
        if (l.includes("progress")) return "text-sky-600"
        if (l.includes("new")) return "text-green-600"
        if (l.includes("career")) return "text-gray-600"
        return "text-blue-600"
    })()

    return (
        <>
            <div className="flex items-center gap-4 min-w-0">
                <div className="w-[96px] hidden md:flex items-center justify-center self-stretch flex-shrink-0 bg-white rounded-lg py-6 px-2 overflow-hidden">
                    <span
                        className={`text-[24px] tracking-widest font-semibold select-none whitespace-nowrap [writing-mode:vertical-rl] rotate-180 ${labelColor}`}
                    >
                        {label}
                    </span>
                </div>

                <div className="flex-1 min-w-0">
                    <Card className="min-h-[250px] py-0 gap-0 rounded-md shadow-sm">
                        <CardContent className="p-0">
                            <div
                                className={`md:hidden flex items-center justify-center px-4 py-4 rounded-lg shadow-sm border border-gray-100 font-semibold ${labelColor} text-2xl tracking-widest`}
                            >
                                {label}
                            </div>

                            <div className="rounded-md overflow-hidden hidden md:block bg-white shadow-sm">
                                <Table className="w-full table-fixed text-sm [&_th]:py-3 [&_th]:h-12 [&_td]:py-3">
                                    <colgroup>
                                        <col className="w-[200px]" />
                                        <col className="w-[150px]" />
                                        <col className="w-[250px]" />
                                        <col className="w-[140px]" />
                                        <col className="w-[120px]" />
                                        <col className="w-[60px]" />
                                    </colgroup>
                                    <TableHeader>
                                        <TableRow className="bg-[#002FFF]">
                                            <TableHead className="text-white">Name</TableHead>
                                            <TableHead className="text-white">Phone Number</TableHead>
                                            <TableHead className="text-white">Description</TableHead>
                                            <TableHead className="text-white">Next Follow Up</TableHead>
                                            <TableHead className="text-white">Status</TableHead>
                                            <TableHead className="text-right text-white">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {prospects.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                                                    No prospects found.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            prospects.map((p) => {
                                                const shortId = `P-${p.id.slice(0, 6).toUpperCase()}`
                                                return (
                                                    <TableRow onClick={() => router.push(`/sales/prospects/${p.id}`)} key={p.id} className="hover:bg-muted/50 cursor-pointer even:bg-muted/30">
                                                        <TableCell className="truncate max-w-[200px] align-top" title={p.name}>
                                                            <div className="flex flex-col">
                                                                <span className="text-foreground font-medium truncate">{p.name || shortId}</span>
                                                            </div>
                                                        </TableCell>

                                                        <TableCell className="truncate max-w-[150px] align-top">{normalizePhoneNumber(p.phoneNumber, p.dialCode).internationalNumber || "N/A"}</TableCell>

                                                        <TableCell className="truncate max-w-[250px] align-top" title={p.description}>
                                                            {p.description || "N/A"}
                                                        </TableCell>

                                                        <TableCell className="whitespace-nowrap align-top" title={p.nextFollowUp || "N/A"}>
                                                            <div className="flex items-center gap-2">
                                                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                                                <span>{formatDate(p.nextFollowUp)

                                                                    || "N/A"}</span>
                                                            </div>
                                                        </TableCell>

                                                        <TableCell className=" align-top">
                                                            <span
                                                                className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${p.status === "New" ? "bg-green-100 text-green-800" : "bg-sky-100 text-sky-800"
                                                                    }`}
                                                            >
                                                                {p.status}
                                                            </span>
                                                        </TableCell>

                                                        <TableCell className="text-right align-top">
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Link
                                                                            href={`/sales/prospects/${p.id}`}
                                                                            className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                                                                            aria-label="View prospect details"
                                                                        >
                                                                            <Eye className="h-5 w-5" />
                                                                        </Link>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent sideOffset={6}>View prospect details</TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            <div className="md:hidden px-4 pb-4 space-y-3">
                                {prospects.length === 0 ? (
                                    <div className="text-center py-6 text-muted-foreground">No prospects found.</div>
                                ) : (
                                    prospects.map((p) => {
                                        const shortId = `P-${p.id.slice(0, 6).toUpperCase()}`
                                        return (
                                            <div key={p.id} className="rounded-md border bg-white p-3 shadow-sm">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-[#1f7aff]">{p.name || shortId}</span>
                                                        <span className="text-xs text-muted-foreground">{p.phoneNumber || "-"}</span>
                                                    </div>
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Link
                                                                    href={`/sales/prospects/${p.id}`}
                                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                                                                    aria-label="View prospect details"
                                                                >
                                                                    <Eye className="h-4 w-4" />
                                                                </Link>
                                                            </TooltipTrigger>
                                                            <TooltipContent sideOffset={6}>View prospects with this status</TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </div>

                                                <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                                                    <div>
                                                        <div className="font-medium text-foreground">Description</div>
                                                        <div className="truncate">{p.description || "N/A"}</div>
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-foreground">Status</div>
                                                        <span
                                                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${p.status === "New" ? "bg-green-100 text-green-800" : "bg-sky-100 text-sky-800"
                                                                }`}
                                                        >
                                                            {p.status}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
            <div className="flex justify-end">
                <Link
                    href={`/sales/prospects/table?status=${encodeURIComponent(label === "New Prospects" ? "New" : label)}`}
                    className="bg-[#002FFF] cursor-pointer text-white text-[14px] py-[10px] mt-[10px] px-[10px] rounded-[5px] inline-block"
                >
                    View more
                </Link>
            </div>
        </>
    )
}

export default function ProspectsPage() {
    const router = useRouter()
    const [prospects, setProspects] = useState<Prospect[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        setLoading(true)
        fetch('/api/prospects')
            .then(res => res.json())
            .then(data => {
                if (data.prospects) {
                    console.log(data.prospects)
                    setProspects(data.prospects.filter((p: Prospect) => !p.archived))
                } else {
                    setProspects([])
                }
                setLoading(false)
            })
            .catch(() => {
                setProspects([])
                setLoading(false)
            })
    }, [])

    const newProspects = prospects.filter((p) => p.status === "New")
    const inProgressProspects = prospects.filter((p) => p.status === "In Progress")
    const inRelevantNotNowProspects = prospects.filter((p) => p.status === "Relevant but not Now")
    const inCarrerProspects = prospects.filter((p) => p.status === "Career")
    const inRelevantNotProspects = prospects.filter((p) => p.status === "Not Relevant")
    const totalProspects = prospects.length
    const newCount = newProspects.length
    const inProgressCount = inProgressProspects.length

    const newPercent = totalProspects > 0 ? Math.round((newCount / totalProspects) * 100) : 0
    const inProgressPercent = totalProspects > 0 ? Math.round((inProgressCount / totalProspects) * 100) : 0

    return (
        <div className="container mx-auto px-4 py-8 space-y-6 max-w-[1600px]">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">My Prospects</h1>
                    <p className="text-muted-foreground mt-1">Track and manage your prospects</p>
                </div>
                <Button onClick={() => router.push("/sales/prospects/add")} className="mt-[20px] md:mt-none text-white rounded-lg px-4 py-2 flex items-center gap-2 cursor-pointer shadow-none hover:shadow-md transition-shadow duration-300">
                    <Plus className="h-4 w-4" />
                    Create Prospect
                </Button>
            </div>

            {loading ? (
                <div className="flex justify-center items-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <>
                    <div className="grid gap-4 md:grid-cols-3">
                        <StatCard
                            title="Total Prospects"
                            value={totalProspects}
                            percent={100}
                            Icon={ClipboardList}
                            variant="total"
                        />
                        <StatCard title="New" value={newCount} percent={newPercent} Icon={Clock} variant="new" />
                        <StatCard
                            title="In Progress"
                            value={inProgressCount}
                            percent={inProgressPercent}
                            Icon={Loader2}
                            variant="inprogress"
                        />
                    </div>

                    <div className="space-y-8">
                        <SectionTable label="New Prospects" prospects={newProspects.slice(0, 5)} />
                        <SectionTable label="In Progress" prospects={inProgressProspects.slice(0, 5)} />
                        <SectionTable label="Relevant but not Now" prospects={inRelevantNotNowProspects.slice(0, 5)} />
                        <SectionTable label="Career" prospects={inCarrerProspects.slice(0, 5)} />
                        <SectionTable label="Not Relevant" prospects={inRelevantNotProspects.slice(0, 5)} />
                    </div>
                </>
            )}

        </div>
    )
}
