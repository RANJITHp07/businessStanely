"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
    Loader2,
    Trash2,
    Eye,
    Mail,
    Phone,
    Building2,
    ArrowRight,
    CheckCircle2,
    Ban,
    RefreshCcw,
    Inbox,
    UserPlus,
    Users,
} from "lucide-react"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { toast } from "react-toastify"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import { fetchWithAuth } from "@/lib/fetchWithAuth"

/* Enquiries arrive from the public businessPlus website already routed to an
   Advisor Agent by the round-robin in businessPlus/lib/assignEnquiry.ts, which
   only considers agents ticked into "Set Enquiries per Agent" below. Rows can
   still arrive unassigned if nobody was ticked in at the time.
   This screen is the review step before one becomes a lead. */

type Enquiry = {
    id: string
    name: string
    email: string
    phone?: string | null
    company?: string | null
    services: string[]
    payment?: string | null
    notes?: string | null
    source: string
    status: string
    convertedProspectId?: string | null
    convertedAt?: string | null
    convertedByAgent?: { id: string; name: string } | null
    assignedAgent?: { id: string; name: string } | null
    createdAt: string
}

type Agent = { id: string; name: string }

/** An Advisor Agent as offered in the enquiry auto-assignment picker. */
type AssignableAgent = {
    id: string
    name: string
    email: string
    agentType?: string | null
    advisorAgentType?: string | null
    enquiryAutoAssign: boolean
}
type LeadSource = { id: string; name: string }

const STATUSES = ["New", "Reviewed", "Converted", "Spam"]

/** Stat card accents, one per status, matching the section colours below. */
const STAT_COLORS: Record<
    string,
    {
        border: string
        cardBg: string
        bar: string
        iconBg: string
        iconText: string
        trackBg: string
        fill: string
        icon: typeof Inbox
    }
> = {
    New: {
        border: "border-emerald-200", cardBg: "bg-emerald-50/50", bar: "bg-emerald-300",
        iconBg: "bg-emerald-100", iconText: "text-emerald-600",
        trackBg: "bg-emerald-200", fill: "bg-emerald-500", icon: UserPlus,
    },
    Reviewed: {
        border: "border-blue-200", cardBg: "bg-blue-50/50", bar: "bg-blue-300",
        iconBg: "bg-blue-100", iconText: "text-blue-600",
        trackBg: "bg-blue-200", fill: "bg-blue-500", icon: Eye,
    },
    Converted: {
        border: "border-violet-200", cardBg: "bg-violet-50/50", bar: "bg-violet-300",
        iconBg: "bg-violet-100", iconText: "text-violet-600",
        trackBg: "bg-violet-200", fill: "bg-violet-500", icon: CheckCircle2,
    },
    Spam: {
        border: "border-rose-200", cardBg: "bg-rose-50/50", bar: "bg-rose-300",
        iconBg: "bg-rose-100", iconText: "text-rose-600",
        trackBg: "bg-rose-200", fill: "bg-rose-500", icon: Ban,
    },
    Default: {
        border: "border-slate-200", cardBg: "bg-slate-50/50", bar: "bg-slate-300",
        iconBg: "bg-slate-100", iconText: "text-slate-600",
        trackBg: "bg-slate-200", fill: "bg-slate-500", icon: Inbox,
    },
}

/** Section accents, keyed by status and matching the badge colours above. */
const SECTION_COLORS: Record<string, { text: string; bg: string; border: string }> = {
    New: { text: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
    Reviewed: { text: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
    Converted: { text: "text-violet-600", bg: "bg-violet-50", border: "border-violet-100" },
    Spam: { text: "text-rose-600", bg: "bg-rose-50", border: "border-rose-100" },
    Default: { text: "text-slate-700", bg: "bg-slate-50", border: "border-slate-200" },
}


function getStatusBadge(status: string) {
    const s = status.toLowerCase()
    if (s === "new")
        return (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                New
            </Badge>
        )
    if (s === "reviewed")
        return (
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                Reviewed
            </Badge>
        )
    if (s === "converted")
        return (
            <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200">
                Converted
            </Badge>
        )
    if (s === "spam")
        return (
            <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
                Spam
            </Badge>
        )
    return <Badge variant="outline">{status}</Badge>
}

const formatDate = (dateString: string | undefined | null) => {
    if (!dateString) return "N/A"
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return "N/A"
    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    })
}

/**
 * One status section, styled after the ProspectTable blocks on the leads
 * dashboard: a rotated colour-coded label beside a compact table of the most
 * recent rows. `onSelect` opens the enquiry dialog, which is how every status
 * is viewed — a converted enquiry included.
 */
function EnquirySection({
    label,
    enquiries,
    onSelect,
}: {
    label: string
    enquiries: Enquiry[]
    onSelect: (enquiry: Enquiry) => void
}) {
    const { text, bg, border } = SECTION_COLORS[label] ?? SECTION_COLORS.Default

    return (
        <div className="flex items-center gap-4 min-w-0">
            {/* Rotated label column, shown on lg+ */}
            <div
                className={`w-[96px] h-auto hidden lg:flex items-center justify-center self-stretch flex-shrink-0 ${bg} rounded-xl py-6 px-2 shadow-sm border ${border}`}
            >
                <span
                    className={`font-semibold text-sm tracking-wide whitespace-nowrap ${text}`}
                    style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                >
                    {label}
                </span>
            </div>

            <Card className="flex-1 border py-0 border-slate-200 bg-slate-50 rounded-xl shadow-sm overflow-hidden">
                {/* Mobile keeps the label on top, where a rotated column will not fit. */}
                <div className={`lg:hidden ${bg} px-4 py-3 border-b ${border}`}>
                    <h3 className={`font-semibold text-sm ${text}`}>{label}</h3>
                </div>

                <CardContent className="p-0">
                    {enquiries.length === 0 ? (
                        <div className="py-8 text-center text-slate-500 text-sm font-medium">
                            No enquiries found
                        </div>
                    ) : (
                        <>
                            {/* Desktop table */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-white/60">
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Name</th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Contact</th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Services</th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Received</th>
                                            <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600">View</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {enquiries.map((enquiry) => (
                                            <tr
                                                key={enquiry.id}
                                                className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                                                onClick={() => onSelect(enquiry)}
                                            >
                                                <td className="py-3 px-4">
                                                    <p className="font-medium text-sm text-slate-800">{enquiry.name}</p>
                                                    {enquiry.company && (
                                                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                                            <Building2 className="h-3 w-3" />
                                                            <span className="truncate">{enquiry.company}</span>
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <p className="text-sm text-slate-700 flex items-center gap-1.5">
                                                        <Mail className="h-3.5 w-3.5 text-slate-400" />
                                                        {enquiry.email}
                                                    </p>
                                                    {enquiry.phone && (
                                                        <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                                                            <Phone className="h-3 w-3" />
                                                            {enquiry.phone}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex flex-wrap gap-1">
                                                        {enquiry.services.slice(0, 2).map((service) => (
                                                            <Badge key={service} variant="outline" className="text-xs font-normal">
                                                                {service}
                                                            </Badge>
                                                        ))}
                                                        {enquiry.services.length > 2 && (
                                                            <Badge variant="outline" className="text-xs font-normal">
                                                                +{enquiry.services.length - 2}
                                                            </Badge>
                                                        )}
                                                        {enquiry.services.length === 0 && (
                                                            <span className="text-sm text-slate-500">N/A</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <p className="text-sm text-slate-700">{formatDate(enquiry.createdAt)}</p>
                                                </td>
                                                <td className="text-center py-3 px-4">
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Link
                                                                    href={`/dashboard/enquiries/${enquiry.id}`}
                                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                                                                    aria-label="View enquiry details"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    <Eye className="h-4 w-4" />
                                                                </Link>
                                                            </TooltipTrigger>
                                                            <TooltipContent sideOffset={6}>View enquiry details</TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile cards */}
                            <div className="md:hidden divide-y divide-slate-100">
                                {enquiries.map((enquiry) => (
                                    <div
                                        key={enquiry.id}
                                        className="p-4 hover:bg-slate-50/50 transition-colors cursor-pointer"
                                        onClick={() => onSelect(enquiry)}
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="min-w-0">
                                                <p className="font-medium text-sm text-slate-800 mb-1 truncate">{enquiry.name}</p>
                                                <p className="text-xs text-slate-500 truncate">{enquiry.email}</p>
                                            </div>
                                            {getStatusBadge(enquiry.status)}
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 text-xs">
                                            <div className="min-w-0">
                                                <p className="text-slate-500 mb-1">Company</p>
                                                <p className="text-slate-700 font-medium truncate">{enquiry.company || "N/A"}</p>
                                            </div>
                                            <div>
                                                <p className="text-slate-500 mb-1">Received</p>
                                                <p className="text-slate-700 font-medium">{formatDate(enquiry.createdAt)}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {/* Sections show only the 5 most recent, so the full list of
                        this status lives on the table page behind this link. */}
                    {enquiries.length > 0 && (
                        <div className="border-t border-slate-100 p-4 bg-slate-50/30">
                            <Link
                                href={`/dashboard/enquiries/table?status=${encodeURIComponent(label)}`}
                                className="flex items-center justify-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                            >
                                View All {label}
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

export default function EnquiriesPage() {
    /* "Set Enquiries per Agent": which Advisor Agents take website enquiries,
       and how many each takes before the rotation moves on. */
    const [assignOpen, setAssignOpen] = useState(false)
    const [assignAgents, setAssignAgents] = useState<AssignableAgent[]>([])
    const [selectedAssignees, setSelectedAssignees] = useState<string[]>([])
    const [enquiriesPerAgent, setEnquiriesPerAgent] = useState(1)
    const [assignSaving, setAssignSaving] = useState(false)
    const [assignLoading, setAssignLoading] = useState(false)

    const loadAssignmentSetting = useCallback(async () => {
        setAssignLoading(true)
        try {
            const res = await fetchWithAuth("/api/enquiryAssignmentSetting")
            if (!res.ok) throw new Error("Failed to load assignment setting")
            const data = await res.json()
            const agents: AssignableAgent[] = data.agents ?? []
            setAssignAgents(agents)
            setSelectedAssignees(agents.filter((a) => a.enquiryAutoAssign).map((a) => a.id))
            setEnquiriesPerAgent(data.enquiriesPerAgent ?? 1)
        } catch {
            toast.error("Could not load the assignment settings")
        } finally {
            setAssignLoading(false)
        }
    }, [])

    const saveAssignmentSetting = async () => {
        if (enquiriesPerAgent < 1) return
        setAssignSaving(true)
        try {
            const res = await fetchWithAuth("/api/enquiryAssignmentSetting", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    enquiriesPerAgent,
                    selectedAgentIds: selectedAssignees,
                }),
            })
            if (!res.ok) throw new Error("Failed to save")
            toast.success("Enquiry assignment updated")
            setAssignOpen(false)
        } catch {
            toast.error("Could not save the assignment settings")
        } finally {
            setAssignSaving(false)
        }
    }

    const [enquiries, setEnquiries] = useState<Enquiry[]>([])
    const [loading, setLoading] = useState(true)


    const [agents, setAgents] = useState<Agent[]>([])
    const [leadSources, setLeadSources] = useState<LeadSource[]>([])

    const [selected, setSelected] = useState<Enquiry | null>(null)
    const [convertTarget, setConvertTarget] = useState<Enquiry | null>(null)
    const [enquiryToDelete, setEnquiryToDelete] = useState<Enquiry | null>(null)
    const [assignedAgentId, setAssignedAgentId] = useState("")
    const [leadSourceId, setLeadSourceId] = useState("")
    const [busy, setBusy] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetchWithAuth("/api/enquiries?status=all")
            if (!res.ok) throw new Error("Failed to load enquiries")
            const data = await res.json()
            setEnquiries(data.enquiries ?? [])
        } catch {
            toast.error("Could not load enquiries")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        load()
    }, [load])

    /* Agents and lead sources only matter once someone opens the convert
       dialog, but both lists are small and shared by every row. */
    useEffect(() => {
        fetchWithAuth("/api/agents")
            .then((r) => (r.ok ? r.json() : []))
            .then((data) => setAgents(Array.isArray(data) ? data : []))
            .catch(() => setAgents([]))

        fetchWithAuth("/api/lead_source")
            .then((r) => (r.ok ? r.json() : []))
            .then((data) => setLeadSources(Array.isArray(data) ? data : []))
            .catch(() => setLeadSources([]))
    }, [])

    async function setStatus(enquiry: Enquiry, status: string) {
        setBusy(true)
        try {
            const res = await fetchWithAuth(`/api/enquiries/${enquiry.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "Failed to update")
            toast.success(`Marked as ${status}`)
            setSelected(null)
            load()
        } catch (error: any) {
            toast.error(error.message || "Failed to update enquiry")
        } finally {
            setBusy(false)
        }
    }

    async function convert() {
        if (!convertTarget) return
        if (!assignedAgentId) {
            toast.error("Select an agent to assign this lead to")
            return
        }
        setBusy(true)
        try {
            const res = await fetchWithAuth(`/api/enquiries/${convertTarget.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "convert",
                    assignedAgentId,
                    leadSourceId: leadSourceId || undefined,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "Failed to convert")
            toast.success("Enquiry converted to a lead")
            setConvertTarget(null)
            setSelected(null)
            setAssignedAgentId("")
            setLeadSourceId("")
            load()
        } catch (error: any) {
            toast.error(error.message || "Failed to convert enquiry")
        } finally {
            setBusy(false)
        }
    }

    async function handleDelete(id: string) {
        setBusy(true)
        try {
            const res = await fetchWithAuth(`/api/enquiries/${id}`, { method: "DELETE" })
            if (!res.ok) throw new Error("Failed to delete")
            toast.success("Enquiry deleted")
            setEnquiryToDelete(null)
            setSelected(null)
            load()
        } catch (error: any) {
            toast.error(error.message || "Failed to delete enquiry")
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <div className="mb-8">
                <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 md:mb-4">
                    <div>
                        <h1 className="text-3xl font-bold">BusinessPlus Enquiries</h1>
                        <p className="text-muted-foreground mt-2">
                            Service requests submitted on the businessPlus website
                        </p>
                    </div>
                    <div className="flex items-center gap-2 mt-[20px] md:mt-none">
                        <Button
                            variant="outline"
                            className="rounded-lg px-4 py-2 flex items-center gap-2 cursor-pointer"
                            onClick={() => {
                                setAssignOpen(true)
                                loadAssignmentSetting()
                            }}
                        >
                            <Users className="h-4 w-4" />
                            Set Enquiries per Agent
                        </Button>
                        <Link href="/dashboard/enquiries/table">
                            <Button variant="outline" className="rounded-lg px-4 py-2 flex items-center gap-2 cursor-pointer">
                                View All Enquiries
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        </Link>
                        <Button
                            onClick={load}
                            disabled={loading}
                            className="text-white rounded-lg px-4 py-2 flex items-center gap-2 cursor-pointer shadow-none hover:shadow-md transition-shadow duration-300"
                        >
                            <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid gap-4 md:grid-cols-4">
                    {STATUSES.map((status) => {
                        const accent = STAT_COLORS[status] ?? STAT_COLORS.Default
                        const count = enquiries.filter((enquiry) => enquiry.status === status).length
                        // Bar width is the share of all enquiries, so the cards
                        // compare against each other rather than a fixed figure.
                        const share = enquiries.length ? Math.round((count / enquiries.length) * 100) : 0
                        const Icon = accent.icon

                        return (
                            <Card
                                key={status}
                                className={`border ${accent.border} ${accent.cardBg} rounded-xl shadow-sm overflow-hidden`}
                            >
                                <div className={`h-1.5 ${accent.bar}`} />
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-sm font-medium text-slate-700">
                                            {status}
                                        </CardTitle>
                                        <div className={`h-10 w-10 rounded-xl ${accent.iconBg} flex items-center justify-center`}>
                                            <Icon className={`h-5 w-5 ${accent.iconText}`} />
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        <div className="text-3xl font-bold text-slate-800">{count}</div>
                                        <div className={`w-full ${accent.trackBg} h-1.5 rounded-full overflow-hidden`}>
                                            <div className={`${accent.fill} h-full`} style={{ width: `${share}%` }} />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            </div>


            {/* -------- Status sections -------- */}
            {!loading && (
                <div className="space-y-6 mt-8">
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-slate-200 flex items-center justify-center">
                            <Inbox className="h-4 w-4 text-slate-700" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800">Enquiries by Status</h2>
                    </div>

                    {/* Each section shows the 5 most recent of that status; the
                        filtered table above is where the full list is browsed. */}
                    {STATUSES.map((status) => (
                        <EnquirySection
                            key={status}
                            label={status}
                            enquiries={enquiries
                                .filter((enquiry) => enquiry.status === status)
                                .slice(0, 5)}
                            onSelect={setSelected}
                        />
                    ))}
                </div>
            )}

            {/* ---------------- Detail ---------------- */}
            {/* Auto-assignment settings. Mirrors "Set Leads per Agent" on the
                leads dashboard, but writes enquiryAutoAssign so the two queues
                stay independent. */}
            <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
                <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Assign Enquiries Automatically</DialogTitle>
                        <DialogDescription>
                            Choose how many website enquiries each agent is assigned
                            before the next agent's turn, and which Advisor Agents take
                            part. Only ticked agents receive new enquiries.
                        </DialogDescription>
                    </DialogHeader>

                    {assignLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="enquiries-per-agent">Enquiries per agent</Label>
                                <input
                                    id="enquiries-per-agent"
                                    type="number"
                                    min={1}
                                    value={enquiriesPerAgent}
                                    onChange={(e) =>
                                        setEnquiriesPerAgent(Math.max(1, Number(e.target.value) || 1))
                                    }
                                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Advisor Agents</Label>
                                {assignAgents.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        No active Advisor Agents to choose from.
                                    </p>
                                ) : (
                                    <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
                                        {assignAgents.map((agent) => (
                                            <label
                                                key={agent.id}
                                                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-slate-50"
                                            >
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4"
                                                    checked={selectedAssignees.includes(agent.id)}
                                                    onChange={() =>
                                                        setSelectedAssignees((prev) =>
                                                            prev.includes(agent.id)
                                                                ? prev.filter((id) => id !== agent.id)
                                                                : [...prev, agent.id],
                                                        )
                                                    }
                                                />
                                                <span className="text-sm">
                                                    {agent.name}
                                                    <span className="ml-2 text-xs text-muted-foreground">
                                                        {agent.advisorAgentType || agent.agentType || "Advisor Agent"}
                                                    </span>
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                                {selectedAssignees.length === 0 && assignAgents.length > 0 && (
                                    <p className="text-xs text-amber-600">
                                        With nobody ticked, new enquiries arrive unassigned and
                                        must be routed by hand.
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAssignOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={saveAssignmentSetting} disabled={assignSaving || assignLoading}>
                            {assignSaving ? "Saving..." : "Save"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    {selected && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-3">
                                    {selected.name}
                                    {getStatusBadge(selected.status)}
                                </DialogTitle>
                                <DialogDescription>
                                    Received {formatDate(selected.createdAt)} from the businessPlus website.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4 text-sm">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div>
                                        <p className="text-muted-foreground text-xs">Email</p>
                                        <p>{selected.email}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">Phone</p>
                                        <p>{selected.phone || "N/A"}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">Company</p>
                                        <p>{selected.company || "N/A"}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">Payment preference</p>
                                        <p>{selected.payment || "N/A"}</p>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-muted-foreground text-xs mb-1.5">Services requested</p>
                                    {selected.services.length ? (
                                        <div className="flex flex-wrap gap-1.5">
                                            {selected.services.map((s) => (
                                                <Badge key={s} variant="outline" className="font-normal">
                                                    {s}
                                                </Badge>
                                            ))}
                                        </div>
                                    ) : (
                                        <p>N/A</p>
                                    )}
                                </div>

                                <div>
                                    <p className="text-muted-foreground text-xs mb-1">Notes</p>
                                    <p className="whitespace-pre-wrap">{selected.notes || "N/A"}</p>
                                </div>

                                {selected.status === "Converted" && (
                                    <div className="rounded-md bg-violet-50 border border-violet-200 p-3">
                                        <p className="text-violet-800">
                                            Converted {formatDate(selected.convertedAt)}
                                            {selected.convertedByAgent
                                                ? `, assigned to ${selected.convertedByAgent.name}`
                                                : ""}
                                            .
                                        </p>
                                        {selected.convertedProspectId && (
                                            <Link
                                                href={`/dashboard/prospects/${selected.convertedProspectId}`}
                                                className="text-violet-900 underline text-xs"
                                            >
                                                Open the lead
                                            </Link>
                                        )}
                                    </div>
                                )}
                            </div>

                            <DialogFooter className="flex-wrap gap-2 sm:justify-between">
                                <Button
                                    variant="outline"
                                    className="text-destructive"
                                    onClick={() => setEnquiryToDelete(selected)}
                                    disabled={busy}
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                </Button>

                                {selected.status !== "Converted" && (
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            variant="outline"
                                            onClick={() => setStatus(selected, "Spam")}
                                            disabled={busy}
                                        >
                                            <Ban className="h-4 w-4 mr-2" />
                                            Spam
                                        </Button>
                                        {selected.status !== "Reviewed" && (
                                            <Button
                                                variant="outline"
                                                onClick={() => setStatus(selected, "Reviewed")}
                                                disabled={busy}
                                            >
                                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                                Mark reviewed
                                            </Button>
                                        )}
                                        <Button
                                            onClick={() => {
                                                setConvertTarget(selected)
                                                setAssignedAgentId("")
                                                setLeadSourceId("")
                                            }}
                                            disabled={busy}
                                        >
                                            Accept
                                        </Button>
                                    </div>
                                )}
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* ---------------- Convert ---------------- */}
            <Dialog open={!!convertTarget} onOpenChange={(open) => !open && setConvertTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Accept</DialogTitle>
                        <DialogDescription>
                            Accepting creates a lead from {convertTarget?.name}&apos;s enquiry and
                            assigns it to an agent. The enquiry is marked as converted and the
                            client sees it as accepted. This cannot be undone.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Assign to agent</Label>
                            <Select value={assignedAgentId} onValueChange={setAssignedAgentId}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select an agent" />
                                </SelectTrigger>
                                <SelectContent>
                                    {agents.map((agent) => (
                                        <SelectItem key={agent.id} value={agent.id}>
                                            {agent.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Lead source (optional)</Label>
                            <Select value={leadSourceId} onValueChange={setLeadSourceId}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select a lead source" />
                                </SelectTrigger>
                                <SelectContent>
                                    {leadSources.map((source) => (
                                        <SelectItem key={source.id} value={source.id}>
                                            {source.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConvertTarget(null)} disabled={busy}>
                            Cancel
                        </Button>
                        <Button onClick={convert} disabled={busy || !assignedAgentId}>
                            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Accept
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ---------------- Delete ---------------- */}
            <AlertDialog
                open={!!enquiryToDelete}
                onOpenChange={() => setEnquiryToDelete(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will delete the enquiry from &quot;{enquiryToDelete?.name}&quot;. Any lead
                            already created from it is not affected.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => handleDelete(enquiryToDelete?.id!)}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
