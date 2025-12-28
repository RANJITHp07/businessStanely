"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, UserPlus, Calendar, TrendingUp, ArrowRight, Activity, BarChart3 } from "lucide-react"
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

// Mock data
const statsData = {
    total: 248,
    new: 89,
    inProgress: 64,
}

const dateWiseData = {
    toBeContacted: 45,
    contacted: 78,
    missedOut: 23,
}

const leadSourceData = [
    { name: "Website", value: 92, color: "#3b82f6" },
    { name: "Referral", value: 68, color: "#10b981" },
    { name: "Phone Call", value: 51, color: "#f59e0b" },
    { name: "Campaign", value: 37, color: "#8b5cf6" },
]

const statusCategoryData = [
    { status: "New", count: 89, color: "#10b981" },
    { status: "In Progress", count: 64, color: "#3b82f6" },
    { status: "Contacted", count: 58, color: "#0ea5e9" },
    { status: "Missed", count: 37, color: "#ef4444" },
    { status: "Follow Up", count: 20, color: "#f87171" },
]

const prospectsData = {
    new: [
        {
            id: 1,
            name: "Sarah Johnson",
            email: "sarah.johnson@email.com",
            phone: "(555) 123-4567",
            company: "Tech Solutions Inc",
            source: "Website",
            advisor: "John Smith",
            advisorRole: "Senior Advisor",
            nextFollowUp: "2024-01-20",
            status: "New",
            priority: "High",
        },
        {
            id: 2,
            name: "Michael Chen",
            email: "m.chen@company.com",
            phone: "(555) 234-5678",
            company: "Digital Ventures",
            source: "Referral",
            advisor: "Emily Davis",
            advisorRole: "Sales Rep",
            nextFollowUp: "2024-01-21",
            status: "New",
            priority: "Medium",
        },
        {
            id: 3,
            name: "Emma Williams",
            email: "emma.w@business.com",
            phone: "(555) 345-6789",
            company: "Global Enterprises",
            source: "Phone Call",
            advisor: "Robert Brown",
            advisorRole: "Lead Advisor",
            nextFollowUp: "2024-01-22",
            status: "New",
            priority: "High",
        },
        {
            id: 4,
            name: "James Wilson",
            email: "j.wilson@startup.io",
            phone: "(555) 456-7890",
            company: "Innovation Labs",
            source: "Campaign",
            advisor: "Sarah Miller",
            advisorRole: "Account Manager",
            nextFollowUp: "2024-01-23",
            status: "New",
            priority: "Low",
        },
    ],
    inProgress: [
        {
            id: 6,
            name: "David Brown",
            email: "david.b@corporate.com",
            phone: "(555) 678-9012",
            company: "Enterprise Corp",
            source: "Website",
            advisor: "John Smith",
            advisorRole: "Senior Advisor",
            nextFollowUp: "2024-01-19",
            status: "In Progress",
            priority: "High",
        },
        {
            id: 7,
            name: "Sophia Taylor",
            email: "sophia.t@firm.com",
            phone: "(555) 789-0123",
            company: "Consulting Firm",
            source: "Referral",
            advisor: "Emily Davis",
            advisorRole: "Sales Rep",
            nextFollowUp: "2024-01-20",
            status: "In Progress",
            priority: "Medium",
        },
        {
            id: 8,
            name: "Daniel Wilson",
            email: "d.wilson@business.net",
            phone: "(555) 890-1234",
            company: "Business Solutions",
            source: "Phone Call",
            advisor: "Robert Brown",
            advisorRole: "Lead Advisor",
            nextFollowUp: "2024-01-21",
            status: "In Progress",
            priority: "Medium",
        },
    ],
}

const segregationData = {
    toBeContacted: [
        {
            id: 101,
            name: "Alex Rodriguez",
            email: "alex.r@techcorp.com",
            phone: "(555) 111-2222",
            company: "TechCorp Solutions",
            source: "Website",
            advisor: "John Smith",
            advisorRole: "Senior Advisor",
            nextFollowUp: "2024-01-18",
            status: "To Be Contacted",
            priority: "High",
            scheduledDate: "2024-01-18",
        },
        {
            id: 102,
            name: "Jessica Parker",
            email: "j.parker@innovate.io",
            phone: "(555) 222-3333",
            company: "Innovate Labs",
            source: "Referral",
            advisor: "Emily Davis",
            advisorRole: "Sales Rep",
            nextFollowUp: "2024-01-19",
            status: "To Be Contacted",
            priority: "Medium",
            scheduledDate: "2024-01-19",
        },
        {
            id: 103,
            name: "Robert Martinez",
            email: "r.martinez@global.com",
            phone: "(555) 333-4444",
            company: "Global Industries",
            source: "Campaign",
            advisor: "Sarah Miller",
            advisorRole: "Account Manager",
            nextFollowUp: "2024-01-20",
            status: "To Be Contacted",
            priority: "High",
            scheduledDate: "2024-01-20",
        },
    ],
    contacted: [
        {
            id: 201,
            name: "Lisa Anderson",
            email: "l.anderson@business.net",
            phone: "(555) 444-5555",
            company: "Business Dynamics",
            source: "Website",
            advisor: "Robert Brown",
            advisorRole: "Lead Advisor",
            lastContactDate: "2024-01-16",
            status: "Contacted",
            priority: "Medium",
            contactedDate: "2024-01-16",
        },
        {
            id: 202,
            name: "Tom Harris",
            email: "t.harris@startupco.io",
            phone: "(555) 555-6666",
            company: "StartupCo",
            source: "Phone Call",
            advisor: "Emily Davis",
            advisorRole: "Sales Rep",
            lastContactDate: "2024-01-15",
            status: "Contacted",
            priority: "High",
            contactedDate: "2024-01-15",
        },
        {
            id: 203,
            name: "Maria Garcia",
            email: "m.garcia@enterprises.com",
            phone: "(555) 666-7777",
            company: "Garcia Enterprises",
            source: "Referral",
            advisor: "John Smith",
            advisorRole: "Senior Advisor",
            lastContactDate: "2024-01-17",
            status: "Contacted",
            priority: "Low",
            contactedDate: "2024-01-17",
        },
    ],
    missedOut: [
        {
            id: 301,
            name: "Kevin Thompson",
            email: "k.thompson@ventures.com",
            phone: "(555) 777-8888",
            company: "Thompson Ventures",
            source: "Website",
            advisor: "Sarah Miller",
            advisorRole: "Account Manager",
            missedDate: "2024-01-14",
            status: "Missed",
            priority: "High",
            scheduledDate: "2024-01-14",
        },
        {
            id: 302,
            name: "Amanda White",
            email: "a.white@solutions.io",
            phone: "(555) 888-9999",
            company: "White Solutions",
            source: "Campaign",
            advisor: "Robert Brown",
            advisorRole: "Lead Advisor",
            missedDate: "2024-01-13",
            status: "Missed",
            priority: "Medium",
            scheduledDate: "2024-01-13",
        },
    ],
}

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

function getPriorityBadge(priority: string) {
    const p = priority.toLowerCase()
    if (p === "high")
        return (
            <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 px-3 py-1 rounded-md text-xs font-medium border border-rose-200">
                High
            </span>
        )
    if (p === "medium")
        return (
            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-3 py-1 rounded-md text-xs font-medium border border-amber-200">
                Medium
            </span>
        )
    return (
        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-md text-xs font-medium border border-emerald-200">
            Low
        </span>
    )
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
                    {/* Desktop table view */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full">
                            <thead className=" border-b border-slate-200 text-white py-2 bg-[#003459]">
                                <tr>
                                    <th className="text-left py-3 px-4 text-xs font-semibold  uppercase tracking-wide">
                                        Name
                                    </th>
                                    <th className="text-left py-3 px-4 text-xs font-semibold  uppercase tracking-wide">
                                        Company
                                    </th>
                                    <th className="text-left py-3 px-4 text-xs font-semibold  uppercase tracking-wide">
                                        Status
                                    </th>
                                    <th className="text-left py-3 px-4 text-xs font-semibold  uppercase tracking-wide">
                                        Assigned To
                                    </th>
                                    <th className="text-left py-3 px-4 text-xs font-semibold  uppercase tracking-wide">
                                        Priority
                                    </th>
                                    <th className="text-left py-3 px-4 text-xs font-semibold  uppercase tracking-wide">
                                        Follow Up
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
                                            <p className="text-sm text-slate-700">{prospect.company}</p>
                                        </td>
                                        <td className="py-3 px-4">{getStatusBadge(prospect.status)}</td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center text-xs font-semibold text-slate-700">
                                                    {prospect.advisor
                                                        .split(" ")
                                                        .map((n: string) => n[0])
                                                        .join("")}
                                                </div>
                                                <span className="text-sm text-slate-700">{prospect.advisor}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">{getPriorityBadge(prospect.priority)}</td>
                                        <td className="py-3 px-4">
                                            <p className="text-sm ">{prospect.nextFollowUp}</p>
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
                                        <p className="text-slate-500 mb-1">Priority</p>
                                        {getPriorityBadge(prospect.priority)}
                                    </div>
                                    <div>
                                        <p className="text-slate-500 mb-1">Advisor</p>
                                        <p className="text-slate-700 font-medium">{prospect.advisor}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500 mb-1">Follow Up</p>
                                        <p className="text-slate-700 font-medium">{prospect.nextFollowUp}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="border-t border-slate-100 p-4 bg-slate-50/30">
                        <a
                            href={`/dashboard/prospects/table`}

                            className="flex items-center justify-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                        >
                            View All {label}
                            <ArrowRight className="h-4 w-4" />
                        </a>
                    </div>
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
                    {/* Desktop table view */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full">
                            <thead className="text-white border-b py-2 border-slate-200 bg-[#003459]">
                                <tr>
                                    <th className="text-left py-3 px-4 text-xs font-semibold  uppercase tracking-wide">
                                        Name
                                    </th>
                                    <th className="text-left py-3 px-4 text-xs font-semibold  uppercase tracking-wide">
                                        Company
                                    </th>
                                    <th className="text-left py-3 px-4 text-xs font-semibold  uppercase tracking-wide">
                                        Status
                                    </th>
                                    <th className="text-left py-3 px-4 text-xs font-semibold  uppercase tracking-wide">
                                        Assigned To
                                    </th>
                                    <th className="text-left py-3 px-4 text-xs font-semibold  uppercase tracking-wide">
                                        Source
                                    </th>
                                    <th className="text-left py-3 px-4 text-xs font-semibold  uppercase tracking-wide">
                                        {dateLabel}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {leads.map((lead) => (
                                    <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="py-3 px-4">
                                            <div>
                                                <p className="text-sm font-medium text-slate-800">{lead.name}</p>
                                                <p className="text-xs text-slate-500">{lead.email}</p>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <p className="text-sm text-slate-700">{lead.company}</p>
                                        </td>
                                        <td className="py-3 px-4">{getStatusBadge(lead.status)}</td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center text-xs font-semibold text-slate-700">
                                                    {lead.advisor
                                                        .split(" ")
                                                        .map((n: string) => n[0])
                                                        .join("")}
                                                </div>
                                                <span className="text-sm text-slate-700">{lead.advisor}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-3 py-1 rounded-md text-xs font-medium">
                                                {lead.source}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <p className="text-sm ">
                                                {lead.scheduledDate || lead.contactedDate || lead.missedDate || lead.nextFollowUp}
                                            </p>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile card view */}
                    <div className="md:hidden divide-y divide-slate-100">
                        {leads.map((lead) => (
                            <div key={lead.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <p className="font-medium text-sm text-slate-800 mb-1">{lead.name}</p>
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
                                            {lead.scheduledDate || lead.contactedDate || lead.missedDate || lead.nextFollowUp}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="border-t border-slate-100 p-4 bg-slate-50/30">
                        <a
                            href={`/dashboard/prospects/table`}
                            className="flex items-center justify-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                        >
                            View All {label}
                            <ArrowRight className="h-4 w-4" />
                        </a>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

export default function ProspectDashboard() {
    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800 mb-1">Prospect Reports Dashboard</h1>
                        <p className="">Track and manage your sales prospects</p>
                    </div>
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
                                <div className="text-3xl font-bold text-slate-800">{statsData.total}</div>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 text-xs">
                                        <TrendingUp className="h-3 w-3 mr-1" />
                                        12% vs last month
                                    </Badge>
                                </div>
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
                                <div className="text-3xl font-bold text-slate-800">{statsData.new}</div>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
                                        <TrendingUp className="h-3 w-3 mr-1" />
                                        18% vs last month
                                    </Badge>
                                </div>
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
                                <div className="text-3xl font-bold text-slate-800">{statsData.inProgress}</div>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200 text-xs">
                                        <TrendingUp className="h-3 w-3 mr-1" />
                                        8% vs last month
                                    </Badge>
                                </div>
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
                                        data={leadSourceData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {leadSourceData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="grid grid-cols-2 gap-3 mt-4">
                                {leadSourceData.map((source) => (
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
                                <div className="text-4xl font-bold text-amber-600 mb-2">{dateWiseData.toBeContacted}</div>
                                <p className="text-sm ">Scheduled for follow-up</p>
                            </CardContent>
                        </Card>

                        {/* Leads Contacted */}
                        <Card className="border border-sky-200 bg-sky-50/50 rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                            <div className="h-1.5 bg-sky-300" />
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-semibold text-slate-700">Leads Contacted</CardTitle>
                                    <div className="h-10 w-10 rounded-xl bg-sky-100 flex items-center justify-center">
                                        <UserPlus className="h-5 w-5 text-sky-600" />
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-4xl font-bold text-sky-600 mb-2">{dateWiseData.contacted}</div>
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
                                <div className="text-4xl font-bold text-rose-600 mb-2">{dateWiseData.missedOut}</div>
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

                    <ProspectTable label="New Prospects" prospects={prospectsData.new} statusFilter="new" />
                    <ProspectTable
                        label="In Progress Prospects"
                        prospects={prospectsData.inProgress}
                        statusFilter="in-progress"
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
                        leads={segregationData.toBeContacted}
                        statusFilter="to-be-contacted"
                        dateLabel="Scheduled Date"
                    />
                    <SegregationTable
                        label="Leads Contacted"
                        leads={segregationData.contacted}
                        statusFilter="contacted"
                        dateLabel="Contacted Date"
                    />
                    <SegregationTable
                        label="Leads Missed Out"
                        leads={segregationData.missedOut}
                        statusFilter="missed"
                        dateLabel="Missed Date"
                    />
                </div>
            </div>
        </div>
    )
}
