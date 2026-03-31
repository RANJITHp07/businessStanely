"use client"
import type React from "react"
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ClipboardList, Loader2, FileText, CheckCircle, XCircle, Eye, Calendar } from "lucide-react"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import { Progress } from "@/components/ui/progress"
import Link from "next/link"
import { normalizePhoneNumber } from "@/lib/normalizePhoneNumber"
import { useRouter } from "next/navigation"

// Mock data type for opportunities
interface Opportunity {
    id: string
    name: string
    phoneNumber: string
    description: string
    amount: number
    nextFollowUp?: string
    status: "Proposal Issued" | "Closed as Won" | "Closed as Loss"
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

function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount)
}

type StatVariant = "total" | "proposal" | "won" | "loss"

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
    proposal: {
        bar: "bg-amber-500",
        iconWrap: "text-amber-700 bg-amber-100",
        value: "text-amber-800",
        title: "text-amber-800",
        light: "bg-amber-50",
        indicator: "[&_[data-slot=progress-indicator]]:bg-amber-500",
    },
    won: {
        bar: "bg-green-500",
        iconWrap: "text-green-700 bg-green-100",
        value: "text-green-800",
        title: "text-green-800",
        light: "bg-green-50",
        indicator: "[&_[data-slot=progress-indicator]]:bg-green-500",
    },
    loss: {
        bar: "bg-red-500",
        iconWrap: "text-red-700 bg-red-100",
        value: "text-red-800",
        title: "text-red-800",
        light: "bg-red-50",
        indicator: "[&_[data-slot=progress-indicator]]:bg-red-500",
    },
}

function StatCard({
    title,
    value,
    percent,
    Icon,
    variant,
    amount,
}: {
    title: string
    value: number
    percent: number
    Icon: React.ComponentType<{ className?: string }>
    variant: StatVariant
    amount?: number
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
                {amount !== undefined && (
                    <div className="text-sm font-medium text-muted-foreground">{formatCurrency(amount)}</div>
                )}
                <Progress value={percent} className={`${s.light} ${s.indicator}`} />
            </CardContent>
        </Card>
    )
}

function SectionTable({ label, opportunities }: { label: string; opportunities: any[] }) {
    const router = useRouter()
    const labelColor = (() => {
        const l = label.toLowerCase()
        if (l.includes("won")) return "text-green-600"
        if (l.includes("loss")) return "text-red-600"
        if (l.includes("proposal")) return "text-amber-600"
        return "text-blue-600"
    })()

    const statusValue = (() => {
        const l = label.toLowerCase()
        if (l.includes("won")) return "Closed as Won"
        if (l.includes("loss")) return "Closed as Loss"
        if (l.includes("proposal")) return "Proposal Issued"
        return ""
    })()

    return (
        <>
            <div className="flex items-center gap-4 min-w-0">
                <div className="w-[96px] h-auto hidden md:flex items-center justify-center self-stretch flex-shrink-0 bg-white rounded-lg py-6 px-2">
                    <span
                        className={`block rotate-[-90deg] origin-center whitespace-nowrap tracking-widest font-semibold select-none text-[24px] ${labelColor}`}
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
                                        <col className="w-[180px]" />
                                        <col className="w-[140px]" />
                                        <col className="w-[200px]" />
                                        <col className="w-[120px]" />
                                        <col className="w-[130px]" />
                                        <col className="w-[120px]" />
                                        <col className="w-[60px]" />
                                    </colgroup>
                                    <TableHeader>
                                        <TableRow className="bg-[#002FFF]">
                                            <TableHead className="text-white">Name</TableHead>
                                            <TableHead className="text-white">Phone Number</TableHead>
                                            <TableHead className="text-white">Description</TableHead>
                                            <TableHead className="text-white">Amount</TableHead>
                                            <TableHead className="text-white">Next Follow Up</TableHead>
                                            <TableHead className="text-white">Status</TableHead>
                                            <TableHead className="text-right text-white">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {opportunities.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">
                                                    No opportunities found.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            opportunities.map((opp) => {
                                                const shortId = `O-${opp.id.slice(0, 6).toUpperCase()}`
                                                return (
                                                    <TableRow onClick={() => router.push(`/sales/opportunites/${opp.id}`)} key={opp.id} className="hover:bg-muted/50 even:bg-muted/30 cursor-pointer">
                                                        <TableCell className="truncate max-w-[180px] align-top" title={opp.name}>
                                                            <div className="flex flex-col">
                                                                <span className="text-foreground font-medium truncate">{opp.prospect?.name || shortId}</span>
                                                            </div>
                                                        </TableCell>

                                                        <TableCell className="truncate max-w-[140px] align-top">{normalizePhoneNumber(opp.prospect.phoneNumber!, opp.prospect.dialCode).internationalNumber || "N/A"}</TableCell>

                                                        <TableCell className="truncate max-w-[200px] align-top" title={opp.prospect.description}>
                                                            {opp.description || "N/A"}
                                                        </TableCell>

                                                        <TableCell className="whitespace-nowrap align-top font-semibold">
                                                            {
                                                                opp.prospect?.amount !== null && opp.prospect?.amount !== undefined
                                                                    ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(opp.prospect?.amount)
                                                                    : "0"
                                                            }
                                                        </TableCell>

                                                        <TableCell className="whitespace-nowrap align-top" title={opp.nextFollowUp || ""}>
                                                            <div className="flex items-center gap-2">
                                                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                                                <span>{formatDate(opp.nextFollowUp)}</span>
                                                            </div>
                                                        </TableCell>

                                                        <TableCell className="truncate max-w-[120px] align-top">
                                                            <span
                                                                className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${opp.status === "Proposal Issued"
                                                                    ? "bg-amber-100 text-amber-800"
                                                                    : opp.status === "Closed as Won"
                                                                        ? "bg-green-100 text-green-800"
                                                                        : "bg-red-100 text-red-800"
                                                                    }`}
                                                            >
                                                                {opp.status}
                                                            </span>
                                                        </TableCell>

                                                        <TableCell className="text-right align-top">
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Link
                                                                            href={`/sales/opportunites/${opp.id}`}
                                                                            className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                                                                            aria-label="View opportunities with this status"
                                                                        >
                                                                            <Eye className="h-5 w-5" />
                                                                        </Link>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent sideOffset={6}>View opportunity details</TooltipContent>
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
                                {opportunities.length === 0 ? (
                                    <div className="text-center py-6 text-muted-foreground">No opportunities found.</div>
                                ) : (
                                    opportunities.map((opp) => {
                                        const shortId = `O-${opp.id.slice(0, 6).toUpperCase()}`
                                        return (
                                            <div key={opp.id} className="rounded-md border bg-white p-3 shadow-sm">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-[#1f7aff]">{opp.name || shortId}</span>
                                                        <span className="text-xs text-muted-foreground">{opp.phoneNumber || "-"}</span>
                                                    </div>
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Link
                                                                    href={`/sales/opportunites/${opp.id}`}
                                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                                                                    aria-label="View opportunities"
                                                                >
                                                                    <Eye className="h-4 w-4" />
                                                                </Link>
                                                            </TooltipTrigger>
                                                            <TooltipContent sideOffset={6}>View opportunity details</TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </div>

                                                <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                                                    <div>
                                                        <div className="font-medium text-foreground">Description</div>
                                                        <div className="truncate">{opp.description || "N/A"}</div>
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-foreground">Amount</div>
                                                        <div className="font-semibold">{
                                                            opp.amount !== null && opp.amount !== undefined
                                                                ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(opp.amount)
                                                                : "0"
                                                        }</div>
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-foreground">Status</div>
                                                        <span
                                                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${opp.status === "Proposal Issued"
                                                                ? "bg-amber-100 text-amber-800"
                                                                : opp.status === "Closed as Won"
                                                                    ? "bg-green-100 text-green-800"
                                                                    : "bg-red-100 text-red-800"
                                                                }`}
                                                        >
                                                            {opp.status}
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
                    href={`/sales/opportunites/table?status=${encodeURIComponent(label)}`}
                    className="bg-[#002FFF] cursor-pointer text-white text-[14px] py-[10px] mt-[10px] px-[10px] rounded-[5px] inline-block"
                >
                    View more
                </Link>
            </div>
        </>
    )
}

export default function OpportunitiesPage() {
    const [opportunities, setOpportunities] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchOpportunities() {
            setLoading(true)
            try {
                const res = await fetch("/api/opportunities", { method: "GET" })
                if (!res.ok) throw new Error("Failed to fetch opportunities")
                const data = await res.json()
                // Ensure all frontend fields are present, fallback to empty string/zero if missing
                const safeData = Array.isArray(data.opportunities)
                    ? data.opportunities.map((opp: any) => ({
                        id: opp.id || "",
                        name: opp.name || "",
                        phoneNumber: opp.phoneNumber || "",
                        description: opp.description || "",
                        amount: typeof opp.amount === "number" ? opp.amount : 0,
                        nextFollowUp: opp.nextFollowUp || "",
                        status: opp.status || "Proposal Issued",
                        prospect: opp.prospect
                    }))
                    : []
                setOpportunities(safeData)
            } catch {
                setOpportunities([])
            }
            setLoading(false)
        }
        fetchOpportunities()
    }, [])

    const proposalOpportunities = opportunities.filter((o) => o.status === "Proposal Issued")
    const newOpportunities = opportunities.filter((o) => o.status === "New Opportunity")
    const wonOpportunities = opportunities.filter((o) => o.status === "Closed as Won")
    const lossOpportunities = opportunities.filter((o) => o.status === "Closed as Loss")

    const totalOpportunities = opportunities.length
    const proposalCount = proposalOpportunities.length
    const wonCount = wonOpportunities.length
    const lossCount = lossOpportunities.length

    const totalAmount = opportunities.reduce((sum, opp) => sum + opp.amount, 0)
    const wonAmount = wonOpportunities.reduce((sum, opp) => sum + opp.amount, 0)

    const proposalPercent = totalOpportunities > 0 ? Math.round((proposalCount / totalOpportunities) * 100) : 0
    const wonPercent = totalOpportunities > 0 ? Math.round((wonCount / totalOpportunities) * 100) : 0
    const lossPercent = totalOpportunities > 0 ? Math.round((lossCount / totalOpportunities) * 100) : 0

    return (
        <div className="container mx-auto px-4 py-8 space-y-6 max-w-[1600px]">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">My Opportunities</h1>
                    <p className="text-muted-foreground mt-1">Track and manage your sales opportunities</p>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <>
                    <div className="grid gap-4 md:grid-cols-4">
                        <StatCard
                            title="Total Opportunities"
                            value={totalOpportunities}
                            percent={100}
                            Icon={ClipboardList}
                            variant="total"
                            amount={totalAmount}
                        />
                        <StatCard
                            title="Proposal Issued"
                            value={proposalCount}
                            percent={proposalPercent}
                            Icon={FileText}
                            variant="proposal"
                        />
                        <StatCard
                            title="Closed as Won"
                            value={wonCount}
                            percent={wonPercent}
                            Icon={CheckCircle}
                            variant="won"
                            amount={wonAmount}
                        />
                        <StatCard title="Closed as Loss" value={lossCount} percent={lossPercent} Icon={XCircle} variant="loss" />
                    </div>

                    <div className="space-y-8">
                        <SectionTable label="New Opportunity" opportunities={newOpportunities.slice(0, 5)} />
                        <SectionTable label="Proposal Issued" opportunities={proposalOpportunities.slice(0, 5)} />
                        <SectionTable label="Closed as Won" opportunities={wonOpportunities.slice(0, 5)} />
                        <SectionTable label="Closed as Loss" opportunities={lossOpportunities.slice(0, 5)} />
                    </div>
                </>
            )}
        </div>
    )
}
