"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, UserPlus, Calendar, TrendingUp, ArrowRight, Activity, BarChart3, Loader2, Eye, Plus } from "lucide-react"
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip as RechartsTooltip,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
} from "recharts"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import Link from "next/link"
import { useRouter } from "next/navigation"

const statusColors = {
    New: "bg-emerald-50 text-emerald-700 border-emerald-200",
    "In Progress": "bg-blue-50 text-blue-700 border-blue-200",
    Contacted: "bg-sky-50 text-sky-700 border-sky-200",
    Missed: "bg-rose-50 text-rose-700 border-rose-200",
}

function getStatusBadge(status: string) {
    const s = status.toLowerCase()
    if (s === "new")
        return (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                New
            </Badge>
        )
    if (s === "in progress")
        return (
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                In Progress
            </Badge>
        )
    if (s === "contacted")
        return (
            <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200">
                Contacted
            </Badge>
        )
    if (s === "missed" || s === "missed out")
        return (
            <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
                Missed
            </Badge>
        )
    if (s === "to be contacted")
        return (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                To Be Contacted
            </Badge>
        )
    return <Badge variant="outline">{status}</Badge>
}


const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "N/A"
    return new Date(dateString).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    })
}

function ProspectTable({ label, prospects, statusFilter }: { label: string; prospects: any[]; statusFilter: string }) {

    const labelColor = (() => {
        const l = label.toLowerCase()
        if (l.includes("progress")) return "text-purple-600"
        if (l.includes("new")) return "text-emerald-600"
        return "text-slate-700"
    })()

    const bgClass = (() => {
        const l = label.toLowerCase()
        if (l.includes("progress")) return "bg-purple-50"
        if (l.includes("new")) return "bg-emerald-50"
        return "bg-slate-50"
    })()

    const borderClass = (() => {
        const l = label.toLowerCase()
        if (l.includes("progress")) return "border-purple-100"
        if (l.includes("new")) return "border-emerald-100"
        return "border-slate-200"
    })()

    return (
        <div className="flex items-center gap-4 min-w-0 ">
            {/* Rotated label column shown on lg+ */}
            <div
                className={`w-[96px] h-auto hidden lg:flex items-center justify-center self-stretch flex-shrink-0 ${bgClass} rounded-xl py-6 px-2 shadow-sm border ${borderClass}`}
            >
                <span
                    className={`font-semibold text-sm tracking-wide whitespace-nowrap ${labelColor}`}
                    style={{
                        writingMode: "vertical-rl",
                        transform: "rotate(180deg)",
                    }}
                >
                    {label}
                </span>
            </div>

            {/* Table content */}
            <Card className="flex-1 border py-0 border-slate-200 bg-slate-50 rounded-xl shadow-sm overflow-hidden">
                {/* Mobile: Show label on top */}
                <div className={`lg:hidden ${bgClass} px-4 py-3 border-b ${borderClass}`}>
                    <h3 className={`font-semibold text-sm ${labelColor}`}>{label}</h3>
                </div>

                <CardContent className="p-0">
                    {prospects.length === 0 ? (
                        <div className="py-8 text-center text-slate-500 text-sm font-medium">
                            No prospect found
                        </div>
                    ) : (
                        <>
                            {/* Desktop table view */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full">
                                    <thead className=" border-b border-slate-200 text-white py-2 bg-[#003459]">
                                        <tr>
                                            <th className="text-left py-3 px-4 text-xs font-semibold  uppercase tracking-wide">
                                                Name
                                            </th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold  uppercase tracking-wide">
                                                Phone Number
                                            </th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold  uppercase tracking-wide">
                                                Status
                                            </th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold  uppercase tracking-wide">
                                                Assigned To
                                            </th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold  uppercase tracking-wide">
                                                Follow Up
                                            </th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold  uppercase tracking-wide">
                                                View
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {prospects.map((prospect) => (
                                            <tr key={prospect.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="py-3 px-4">
                                                    <div>
                                                        <p className="text-sm font-medium text-slate-800">{prospect.name}</p>
                                                        <p className="text-xs text-slate-500">{prospect.email}</p>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <p className="text-sm text-slate-700">{prospect?.phoneNumber}</p>
                                                </td>
                                                <td className="py-3 px-4">{getStatusBadge(prospect.status)}</td>
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center text-xs font-semibold text-slate-700">
                                                            {prospect?.assignedAgent?.name
                                                                .split(" ")
                                                                .map((n: string) => n[0])
                                                                .join("")}
                                                        </div>
                                                        <span className="text-sm text-slate-700">{prospect?.assignedAgent?.name}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <p className="text-sm ">{formatDate(prospect.nextFollowUp)}</p>
                                                </td>
                                                <td className="text-center py-3 px-4 flex justify-center items-center">
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Link
                                                                    href={`/dashboard/prospects/${prospect.id}`}
                                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                                                                    aria-label="View prospect details"
                                                                >
                                                                    <Eye className="h-4 w-4" />
                                                                </Link>
                                                            </TooltipTrigger>
                                                            <TooltipContent sideOffset={6}>View prospects with this status</TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile card view */}
                            <div className="md:hidden divide-y divide-slate-100">
                                {prospects.map((prospect) => (
                                    <div key={prospect.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <p className="font-medium text-sm text-slate-800 mb-1">{prospect.name}</p>
                                                <p className="text-xs text-slate-500">{prospect.email}</p>
                                            </div>
                                            {getStatusBadge(prospect.status)}
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 text-xs">
                                            <div>
                                                <p className="text-slate-500 mb-1">Company</p>
                                                <p className="text-slate-700 font-medium">{prospect.company}</p>
                                            </div>
                                            <div>
                                                <p className="text-slate-500 mb-1">Advisor</p>
                                                <p className="text-slate-700 font-medium">{prospect?.assignedAgent?.name}</p>
                                            </div>
                                            <div>
                                                <p className="text-slate-500 mb-1">Follow Up</p>
                                                <p className="text-slate-700 font-medium">{formatDate(prospect.nextFollowUp)}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {prospects.length > 0 && (
                        <div className="border-t border-slate-100 p-4 bg-slate-50/30">
                            <a
                                href={`/dashboard/prospects/table?status=${statusFilter}`}
                                className="flex items-center justify-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                            >
                                View All {label}
                                <ArrowRight className="h-4 w-4" />
                            </a>
                        </div>
                    )}

                </CardContent>
            </Card>
        </div>
    )
}

function SegregationTable({
    label,
    leads,
    statusFilter,
    dateLabel,
}: {
    label: string
    leads: any[]
    statusFilter: string
    dateLabel: string
}) {
    const labelColor = (() => {
        const l = label.toLowerCase()
        if (l.includes("contacted") && !l.includes("missed")) return "text-sky-600"
        if (l.includes("be contacted")) return "text-amber-600"
        if (l.includes("missed")) return "text-rose-600"
        return "text-blue-600"
    })()

    const bgClass = (() => {
        const l = label.toLowerCase()
        if (l.includes("contacted") && !l.includes("missed")) return "bg-sky-50"
        if (l.includes("be contacted")) return "bg-amber-50"
        if (l.includes("missed")) return "bg-rose-50"
        return "bg-blue-50"
    })()

    const borderClass = (() => {
        const l = label.toLowerCase()
        if (l.includes("contacted") && !l.includes("missed")) return "border-sky-100"
        if (l.includes("be contacted")) return "border-amber-100"
        if (l.includes("missed")) return "border-rose-100"
        return "border-blue-100"
    })()

    return (
        <div className="flex items-center gap-4 min-w-0">
            {/* Rotated label column shown on lg+ */}
            <div
                className={`w-[96px] h-auto hidden lg:flex items-center justify-center self-stretch flex-shrink-0 ${bgClass} rounded-xl py-6 px-2 shadow-sm border ${borderClass}`}
            >
                <span
                    className={`font-semibold text-sm tracking-wide whitespace-nowrap ${labelColor}`}
                    style={{
                        writingMode: "vertical-rl",
                        transform: "rotate(180deg)",
                    }}
                >
                    {label}
                </span>
            </div>

            {/* Table content */}
            <Card className="flex-1 py-0 border border-slate-200 bg-slate-50 rounded-xl shadow-sm overflow-hidden">
                {/* Mobile: Show label on top */}
                <div className={`lg:hidden ${bgClass} px-4 py-3 border-b ${borderClass}`}>
                    <h3 className={`font-semibold text-sm ${labelColor}`}>{label}</h3>
                </div>

                <CardContent className="p-0">
                    {leads.length === 0 ? (
                        <div className="p-4 text-center text-slate-500 font-medium">
                            No prospect found
                        </div>
                    ) : (
                        <>
                            {/* Desktop table view */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full">
                                    <thead className="text-white border-b py-2 border-slate-200 bg-[#003459]">
                                        <tr>
                                            <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide">
                                                Name
                                            </th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide">
                                                Phone Number
                                            </th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide">
                                                Status
                                            </th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide">
                                                Assigned To
                                            </th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide">
                                                {dateLabel}
                                            </th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide">
                                                View
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {leads.map((lead) => (
                                            <tr
                                                key={lead.id}
                                                className="hover:bg-slate-50/50 transition-colors"
                                            >
                                                <td className="py-3 px-4">
                                                    <div>
                                                        <p className="text-sm font-medium text-slate-800">
                                                            {lead.name}
                                                        </p>
                                                        <p className="text-xs text-slate-500">
                                                            {lead.email}
                                                        </p>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <p className="text-sm text-slate-700">
                                                        {lead.phoneNumber}
                                                    </p>
                                                </td>
                                                <td className="py-3 px-4">{getStatusBadge(lead.status)}</td>
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center text-xs font-semibold text-slate-700">
                                                            {lead?.assignedAgent?.name
                                                                .split(" ")
                                                                .map((n: string) => n[0])
                                                                .join("")}
                                                        </div>
                                                        <span className="text-sm text-slate-700">
                                                            {lead?.assignedAgent?.name}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <p className="text-sm ">
                                                        {formatDate(
                                                            lead.scheduledDate ||
                                                            lead.contactedDate ||
                                                            lead.missedDate ||
                                                            lead.nextFollowUp
                                                        )}
                                                    </p>
                                                </td>
                                                <td className="text-center py-3 px-4 flex justify-center items-center">
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Link
                                                                    href={`/sales/prospects/${lead.id}`}
                                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                                                                    aria-label="View prospect details"
                                                                >
                                                                    <Eye className="h-4 w-4" />
                                                                </Link>
                                                            </TooltipTrigger>
                                                            <TooltipContent sideOffset={6}>View prospects with this status</TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile card view */}
                            <div className="md:hidden divide-y divide-slate-100">
                                {leads.map((lead) => (
                                    <div
                                        key={lead.id}
                                        className="p-4 hover:bg-slate-50/50 transition-colors"
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <p className="font-medium text-sm text-slate-800 mb-1">
                                                    {lead.name}
                                                </p>
                                                <p className="text-xs text-slate-500">{lead.email}</p>
                                            </div>
                                            {getStatusBadge(lead.status)}
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 text-xs">
                                            <div>
                                                <p className="text-slate-500 mb-1">Company</p>
                                                <p className="text-slate-700 font-medium">{lead.company}</p>
                                            </div>
                                            <div>
                                                <p className="text-slate-500 mb-1">Source</p>
                                                <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-medium">
                                                    {lead.source}
                                                </span>
                                            </div>
                                            <div>
                                                <p className="text-slate-500 mb-1">Advisor</p>
                                                <p className="text-slate-700 font-medium">{lead.advisor}</p>
                                            </div>
                                            <div>
                                                <p className="text-slate-500 mb-1">{dateLabel}</p>
                                                <p className="text-slate-700 font-medium">
                                                    {lead.scheduledDate ||
                                                        lead.contactedDate ||
                                                        lead.missedDate ||
                                                        lead.nextFollowUp}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* View All link only if leads exist */}
                            {leads.length > 0 && (
                                <div className="border-t border-slate-100 p-4 bg-slate-50/30">
                                    <a
                                        href={`/dashboard/prospects/table?engagementStatus=${statusFilter}`}
                                        className="flex items-center justify-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                                    >
                                        View All {label}
                                        <ArrowRight className="h-4 w-4" />
                                    </a>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}


export default function ProspectDashboard() {
    const router = useRouter()
    const [prospects, setProspects] = useState<any>([])
    const [loading, setLoading] = useState(false)
    const [leadSources, setLeadSources] = useState<any>([])
    const [statusCategoryData, setStatusCategoryData] = useState<any>([])
    const [open, setOpen] = useState(false)
    const [prospectsPerAgent, setProspectsPerAgent] = useState<number>(1)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [agents, setAgents] = useState<any>([])
    const [selectedAgents, setSelectedAgents] = useState<string[]>([])
    const [agentSearchQuery, setAgentSearchQuery] = useState<string>("")

    const handleConfirm = async () => {
        if (!prospectsPerAgent || prospectsPerAgent < 1) return

        try {
            setIsSubmitting(true)

            await fetch("/api/prospectAssignmentSetting", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prospectsPerAgent,
                    selectedAgentIds: selectedAgents,
                }),
            })

            setOpen(false)
        } catch (error) {
            console.error("Failed to save setting")
        } finally {
            setIsSubmitting(false)
            setOpen(false)
        }
    }

    const handleAgentToggle = (agentId: string) => {
        setSelectedAgents((prev) =>
            prev.includes(agentId)
                ? prev.filter((id) => id !== agentId)
                : [...prev, agentId]
        )
    }

    useEffect(() => {
        setLoading(true)

        Promise.all([
            fetch("/api/prospects").then(res => res.json()),
            fetch("/api/lead_source").then(res => res.json()),
            fetch("/api/prospectAssignmentSetting").then((res) => res.json()),
            fetch("/api/agents").then((res) => res.json()),
        ])
            .then(([prospectsRes, leadSourceRes, assignmentSettingRes, agentsRes]) => {
                const prospects = Array.isArray(prospectsRes?.prospects)
                    ? prospectsRes.prospects.filter((p: any) => !p.archived)
                    : []

                setProspects(prospects)

                /* Set agents */
                const agentsList = Array.isArray(agentsRes) ? agentsRes : []
                setAgents(agentsList.filter((agent) => agent.agentRole == "Advisor Agent"))
                setSelectedAgents(
                    agentsList?.filter(
                        (agent) => agent.agentRole === "Advisor Agent" && agent.autoAssign
                    ).map((agent) => agent.id) || []
                );
                /* ---------------- LEAD SOURCE DATA ---------------- */
                const leadSourceColors = [
                    "#3b82f6",
                    "#10b981",
                    "#f59e0b",
                    "#8b5cf6",
                    "#ef4444",
                    "#06b6d4",
                ]

                const leadSourceChartData = Array.isArray(leadSourceRes)
                    ? leadSourceRes.map((source: any, index: number) => ({
                        name: source.name,
                        value: prospects.filter(
                            (p: any) => p.leadSourceId === source.id
                        ).length,
                        color: leadSourceColors[index % leadSourceColors.length],
                    }))
                    : []

                setLeadSources(leadSourceChartData)

                if (assignmentSettingRes?.prospectsPerAgent) {
                    setProspectsPerAgent(assignmentSettingRes.prospectsPerAgent)
                }

                /* ---------------- STATUS CATEGORY DATA ---------------- */
                const today = new Date()

                const statusCounts = {
                    "Follow Up": 0,
                    Missed: 0,
                    "To Be Contacted": 0,
                }

                prospects.forEach((p: any) => {
                    const assignedAgentId = p.assignedAgentId
                    const agentComments = Array.isArray(p.comments)
                        ? p.comments
                            .filter((c: any) => c.authorId === assignedAgentId)
                            .sort(
                                (a: any, b: any) =>
                                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                            )
                        : []

                    if (p.nextFollowUp) {
                        const followUpDate = new Date(p.nextFollowUp)
                        if (agentComments.length === 0) {
                            statusCounts["Follow Up"]++
                        } else {
                            const lastCommentDate = new Date(agentComments[0].createdAt)
                            if (followUpDate > lastCommentDate) statusCounts["Follow Up"]++
                            else statusCounts.Missed++
                        }
                    } else {
                        statusCounts["To Be Contacted"]++
                    }
                })

                const statusCategoryData = [
                    { status: "Follow Up", count: statusCounts["Follow Up"], color: "#f87171" },
                    { status: "Missed", count: statusCounts.Missed, color: "#ef4444" },
                    { status: "To Be Contacted", count: statusCounts["To Be Contacted"], color: "#10b981" },
                ]

                setStatusCategoryData(statusCategoryData)
            })
            .catch((err) => {
                console.error(err)
                setProspects([])
                setLeadSources([])
                setStatusCategoryData([])
            })
            .finally(() => {
                setLoading(false)
            })
    }, [])


    if (loading) {
        return (< div className="flex justify-center items-center py-12" >
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div >
        )
    }
    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8">
            <div className=" mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800 mb-1">Lead Reports Dashboard</h1>
                        <p className="">Track and manage your sales prospects</p>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                        <Button onClick={() => router.push("/dashboard/prospects/add")} >
                            <Plus className="h-4 w-4" />
                            Create Lead
                        </Button>
                        <Button onClick={() => setOpen(true)}>Set Leads per Agent</Button>
                    </div>


                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Assign Lead Automatically</DialogTitle>
                                <DialogDescription>
                                    Decide how many leads each agent should be assigned automatically, and select which agents will participate.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-6">
                                {/* Input Field */}
                                <div>
                                    <Label htmlFor="prospectsPerAgent" className="text-sm font-medium text-slate-700">
                                        Leads per Agent
                                    </Label>
                                    <Input
                                        id="prospectsPerAgent"
                                        type="number"
                                        min={1}
                                        defaultValue={1}
                                        value={prospectsPerAgent}
                                        onChange={(e) => setProspectsPerAgent(Number(e.target.value))}
                                        className="mt-2"
                                    />
                                    <p className="mt-2 text-xs text-slate-500">
                                        This number decides how many prospects each agent should be automatically assigned.
                                    </p>
                                </div>

                                {/* Agents List */}
                                <div>
                                    <Label className="text-sm font-medium text-slate-700 mb-3 block">
                                        Select Agents ({selectedAgents.length} selected)
                                    </Label>

                                    {/* Search Input */}
                                    <Input
                                        type="text"
                                        placeholder="Search agents by name or role..."
                                        value={agentSearchQuery}
                                        onChange={(e) => setAgentSearchQuery(e.target.value)}
                                        className="mb-3"
                                    />

                                    {/* Agents List */}
                                    <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50/50 max-h-96 overflow-y-auto">
                                        {agents.filter((agent: any) =>
                                            agent.name.toLowerCase().includes(agentSearchQuery.toLowerCase()) ||
                                            (agent.role && agent.role.toLowerCase().includes(agentSearchQuery.toLowerCase()))
                                        ).length === 0 ? (
                                            <p className="text-sm text-slate-500 text-center py-8">
                                                {agents.length === 0 ? "No agents available" : "No agents match your search"}
                                            </p>
                                        ) : (
                                            agents
                                                .filter((agent: any) =>
                                                    agent.name.toLowerCase().includes(agentSearchQuery.toLowerCase()) ||
                                                    (agent.role && agent.role.toLowerCase().includes(agentSearchQuery.toLowerCase()))
                                                )
                                                .map((agent: any) => (
                                                    <div
                                                        key={agent.id}
                                                        className="flex items-center gap-3 p-2 rounded-md hover:bg-slate-100/80 transition-colors cursor-pointer"
                                                        onClick={() => handleAgentToggle(agent.id)}
                                                    >
                                                        <Checkbox
                                                            id={`agent-${agent.id}`}
                                                            checked={selectedAgents.includes(agent.id)}
                                                            onCheckedChange={() => handleAgentToggle(agent.id)}
                                                        />
                                                        <div className="flex-1">
                                                            <Label
                                                                htmlFor={`agent-${agent.id}`}
                                                                className="text-sm font-medium text-slate-800 cursor-pointer"
                                                            >
                                                                {agent.name}
                                                            </Label>
                                                            <p className="text-xs text-slate-500">{agent.agentType || "Agent"}</p>
                                                        </div>
                                                    </div>
                                                ))
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <DialogFooter className="flex justify-end gap-2 pt-4">
                                <Button disabled={isSubmitting} variant="outline" onClick={() => setOpen(false)}>
                                    Cancel
                                </Button>
                                <Button disabled={isSubmitting} onClick={handleConfirm}>
                                    {isSubmitting ? "Processing..." : "Confirm"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Stats Cards */}
                <div className="grid gap-4 md:grid-cols-3">
                    {/* Total Prospects */}
                    <Card className="border border-blue-200 bg-blue-50/50 rounded-xl shadow-sm overflow-hidden">
                        <div className="h-1.5 bg-blue-300" />
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-medium text-slate-700">Total Prospects</CardTitle>
                                <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
                                    <Users className="h-5 w-5 text-blue-600" />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <div className="text-3xl font-bold text-slate-800">{prospects.length}</div>
                                <div className="w-full bg-blue-200 h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-blue-500 h-full" style={{ width: "75%" }} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* New Prospects */}
                    <Card className="border border-emerald-200 bg-emerald-50/50 rounded-xl shadow-sm overflow-hidden">
                        <div className="h-1.5 bg-emerald-300" />
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-medium text-slate-700">New Prospects</CardTitle>
                                <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                                    <UserPlus className="h-5 w-5 text-emerald-600" />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <div className="text-3xl font-bold text-slate-800">{prospects.filter((prospect: any) => prospect.status == "New")?.length}</div>
                                <div className="w-full bg-emerald-200 h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-emerald-500 h-full" style={{ width: "60%" }} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* In Progress */}
                    <Card className="border border-purple-200 bg-purple-50/50 rounded-xl shadow-sm overflow-hidden">
                        <div className="h-1.5 bg-purple-300" />
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-medium text-slate-700">In Progress</CardTitle>
                                <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center">
                                    <Activity className="h-5 w-5 text-purple-600" />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <div className="text-3xl font-bold text-slate-800">{prospects.filter((prospect: any) => prospect.status == "In Progress")?.length}</div>
                                <div className="w-full bg-purple-200 h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-purple-500 h-full" style={{ width: "45%" }} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Charts Section */}
                <div className="grid gap-4 md:grid-cols-2">
                    {/* Lead Source Chart */}
                    <Card className="border border-slate-200 bg-slate-50/80 rounded-xl shadow-sm">
                        <CardHeader className="bg-blue-50/50 border-b border-blue-100">
                            <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                                    <BarChart3 className="h-4 w-4 text-blue-600" />
                                </div>
                                <CardTitle className="text-slate-800">Lead Source Distribution</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <ResponsiveContainer width="100%" height={250}>
                                <PieChart>
                                    <Pie
                                        data={leadSources}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {leadSources.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="grid grid-cols-2 gap-3 mt-4">
                                {leadSources.map((source) => (
                                    <div key={source.name} className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: source.color }} />
                                        <span className="text-sm ">
                                            {source.name}: {source.value}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Status Breakdown Chart */}
                    <Card className="border border-slate-200 bg-slate-50/80 rounded-xl shadow-sm">
                        <CardHeader className="bg-purple-50/50 border-b border-purple-100">
                            <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
                                    <BarChart3 className="h-4 w-4 text-purple-600" />
                                </div>
                                <CardTitle className="text-slate-800">Status Category Breakdown</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={statusCategoryData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis dataKey="status" tick={{ fill: "#64748b", fontSize: 12 }} />
                                    <YAxis tick={{ fill: "#64748b", fontSize: 12 }} />
                                    <RechartsTooltip />
                                    <Bar dataKey="count" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>

                {/* Date-wise Lead Tracking Section */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="h-8 w-8 rounded-lg bg-slate-200 flex items-center justify-center">
                            <Calendar className="h-4 w-4 text-slate-700" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800">Date-wise Lead Tracking</h2>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                        {/* Leads To Be Contacted */}
                        <Card className="border border-amber-200 bg-amber-50/50 rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                            <div className="h-1.5 bg-amber-300" />
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-semibold text-slate-700">Leads To Be Contacted</CardTitle>
                                    <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center">
                                        <Calendar className="h-5 w-5 text-amber-600" />
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-4xl font-bold text-amber-600 mb-2">{(statusCategoryData.find((status: any) => status.status == "To Be Contacted")?.count || 0)}</div>
                                <p className="text-sm ">Scheduled for follow-up</p>
                            </CardContent>
                        </Card>

                        {/* Leads Contacted */}
                        <Card className="border border-sky-200 bg-sky-50/50 rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                            <div className="h-1.5 bg-sky-300" />
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-semibold text-slate-700">Follow Up Required</CardTitle>
                                    <div className="h-10 w-10 rounded-xl bg-sky-100 flex items-center justify-center">
                                        <UserPlus className="h-5 w-5 text-sky-600" />
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-4xl font-bold text-sky-600 mb-2">{(statusCategoryData.find((status: any) => status.status == "Follow Up")?.count || 0)}</div>
                                <p className="text-sm ">Successfully reached out</p>
                            </CardContent>
                        </Card>

                        {/* Leads Missed Out */}
                        <Card className="border border-rose-200 bg-rose-50/50 rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                            <div className="h-1.5 bg-rose-300" />
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-semibold text-slate-700">Leads Missed Out</CardTitle>
                                    <div className="h-10 w-10 rounded-xl bg-rose-100 flex items-center justify-center">
                                        <Activity className="h-5 w-5 text-rose-600" />
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-4xl font-bold text-rose-600 mb-2">{statusCategoryData.find((status: any) => status.status == "Missed")?.count || 0}</div>
                                <p className="text-sm ">Requires attention</p>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Prospects Tables */}
                <div className="space-y-6">
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-slate-200 flex items-center justify-center">
                            <Users className="h-4 w-4 text-slate-700" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800">Active Prospects</h2>
                    </div>

                    <ProspectTable label="New Prospects" prospects={prospects.filter((prospect) => prospect.status == "New").slice(0, 5)} statusFilter="New" />
                    <ProspectTable
                        label="In Progress Prospects"
                        prospects={prospects.filter((prospect) => prospect.status == "In Progress").slice(0, 5)}
                        statusFilter="In Progress"
                    />
                </div>

                {/* Segregation Tables */}
                <div className="space-y-6">
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-slate-200 flex items-center justify-center">
                            <Calendar className="h-4 w-4 text-slate-700" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800">Lead Segregation</h2>
                    </div>

                    <SegregationTable
                        label="Leads To Be Contacted"
                        leads={prospects
                            .filter(
                                (prospect) =>
                                    Array.isArray(prospect.comments) &&
                                    prospect.comments.length === 0
                            )
                            .sort(
                                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                            )
                            .slice(0, 5)}
                        statusFilter="To Be Contacted"
                        dateLabel="Scheduled Date"
                    />
                    <SegregationTable
                        label="Follow Up"
                        leads={prospects
                            .filter((prospect: any) => {
                                if (!prospect.nextFollowUp) return false; // no follow-up, skip

                                // get comments by assigned agent
                                const agentComments = (prospect.comments || [])
                                    .filter(c => c.authorId === prospect.assignedAgentId)
                                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                                const lastCommentDate = agentComments[0] ? new Date(agentComments[0].createdAt) : null;
                                const nextFollowUpDate = new Date(prospect.nextFollowUp);

                                // if no comments yet, consider it a follow-up
                                if (!lastCommentDate) return true;

                                // check if follow-up is still upcoming
                                return nextFollowUpDate > lastCommentDate;
                            })
                            .sort((a, b) => new Date(b.nextFollowUp).getTime() - new Date(a.nextFollowUp).getTime()) // latest first
                            .slice(0, 5)}
                        statusFilter="Follow Up"
                        dateLabel="Contacted Date"
                    />
                    <SegregationTable
                        label="Leads Missed Out"
                        leads={prospects
                            .filter((prospect: any) => {
                                if (!prospect.nextFollowUp) return false; // no follow-up, skip

                                // get comments by assigned agent
                                const agentComments = (prospect.comments || [])
                                    .filter(c => c.authorId === prospect.assignedAgentId)
                                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                                const lastCommentDate = agentComments[0] ? new Date(agentComments[0].createdAt) : null;
                                const nextFollowUpDate = new Date(prospect.nextFollowUp);

                                // if no comments yet, consider it a follow-up
                                if (!lastCommentDate) return false;

                                // check if follow-up is still upcoming
                                return nextFollowUpDate < lastCommentDate;
                            })
                            .sort((a, b) => new Date(b.nextFollowUp).getTime() - new Date(a.nextFollowUp).getTime()) // latest first
                            .slice(0, 5)}
                        statusFilter="Missed Out"
                        dateLabel="Missed Date"
                    />
                </div>
            </div>
        </div>
    )
}
