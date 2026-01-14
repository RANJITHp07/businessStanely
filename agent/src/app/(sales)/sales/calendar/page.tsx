"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    ChevronLeft,
    ChevronRight,
    ArrowLeft,
    AlertTriangle,
    Clock,
    Filter,
    Phone,
    FileText,
    CheckCircle,
} from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"


import { useEffect } from "react"
import { useAgentContext } from "@/lib/agent-context"

type Followup = {
    id: string
    date: string
    time?: string
    client?: string
    phone?: string
    type?: string
    description?: string
    status?: string
    priority?: string
}

const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
]


const formatDateIST = (dateStr: string) =>
    new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    })
        .format(new Date(dateStr))
        .split("/")
        .reverse()
        .join("-");

export default function CalendarPage() {
    const agent = useAgentContext()
    const router = useRouter()
    const [currentDate, setCurrentDate] = useState(new Date())
    const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const [selectedFollowup, setSelectedFollowup] = useState<Followup | null>(null)
    const [followups, setFollowups] = useState<Followup[]>([])

    useEffect(() => {
        if (!agent?.id) return
        async function fetchFollowups() {
            const [prospectRes, opportunityRes] = await Promise.all([
                fetch("/api/prospects"),
                fetch("/api/opportunities"),
            ]);

            const prospectData = await prospectRes.json();
            const opportunityData = await opportunityRes.json();

            const getFollowupStatus = (
                nextFollowUp: string,
                comments: { createdAt: string; authorId: string }[] = []
            ): "upcoming" | "missed" => {
                const agentComments = comments
                    .filter(c => c.authorId === agent?.id)
                    .sort(
                        (a, b) =>
                            new Date(b.createdAt).getTime() -
                            new Date(a.createdAt).getTime()
                    );
                if (agentComments.length === 0) return "upcoming";

                const lastCommentDate = new Date(agentComments[0].createdAt);
                const followUpDate = new Date(nextFollowUp);

                return followUpDate > lastCommentDate ? "upcoming" : "missed";
            };

            const prospectFollowups: Followup[] = (prospectData.prospects || [])
                .filter(
                    (p: any) =>
                        p.nextFollowUp &&
                        (p.status === "New" || p.status === "In Progress")
                )
                .map((p: any) => ({
                    id: p.id,
                    date: p.nextFollowUp.split("T")[0],
                    time: p.nextFollowUp.split("T")[1]?.slice(0, 5) || "",
                    client: p.name,
                    phone: p.phoneNumber,
                    type: "Prospect Follow-up",
                    description: p.description,
                    status: getFollowupStatus(p.nextFollowUp, p.comments),
                    priority: "medium",
                }));

            const opportunityFollowups: Followup[] = (opportunityData.opportunities || [])
                .filter(
                    (o: any) =>
                        o.nextFollowUp &&
                        o.status === "Proposal Issued"
                )
                .map((o: any) => ({
                    id: o.id,
                    date: o.nextFollowUp.split("T")[0],
                    time: o.nextFollowUp.split("T")[1]?.slice(0, 5) || "",
                    client: o.prospect?.name,
                    phone: o.prospect?.phoneNumber,
                    type: "Opportunity Follow-up",
                    description: o.description,
                    status: getFollowupStatus(o.nextFollowUp, o.comments),
                    priority: "medium",
                }));

            setFollowups([...prospectFollowups, ...opportunityFollowups]);
        }

        fetchFollowups();
    }, [agent?.id]);


    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear()
        const month = date.getMonth()
        const firstDay = new Date(year, month, 1)
        const lastDay = new Date(year, month + 1, 0)
        const daysInMonth = lastDay.getDate()
        const startingDayOfWeek = firstDay.getDay()
        const days = [] as (Date | null)[]
        for (let i = 0; i < startingDayOfWeek; i++) days.push(null)
        for (let day = 1; day <= daysInMonth; day++) days.push(new Date(year, month, day))
        return days
    }

    const getFollowupsForDate = (date: Date) => {
        const dateString = date.toISOString().split("T")[0]
        return followups.filter((f) => f.date === dateString)
    }

    const previousMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))

    const days = getDaysInMonth(currentDate)
    const missedFollowups = followups.filter((f) => f.status === "missed")
    const upcomingFollowups = followups.filter((f) => f.status === "upcoming")
    const selectedDateFollowups = selectedDate ? getFollowupsForDate(selectedDate) : []

    const getPriorityColor = (priority: string | undefined) => {
        switch (priority) {
            case "high": return "bg-red-100 text-red-700 border-red-300"
            case "medium": return "bg-amber-100 text-amber-700 border-amber-300"
            case "low": return "bg-blue-100 text-blue-700 border-blue-300"
            default: return "bg-gray-100 text-gray-700 border-gray-300"
        }
    }

    const getStatusBadge = (status: string | undefined) => status === "missed" ? "bg-red-500 text-white" : "bg-green-500 text-white"

    return (
        <div className="min-h-screen flex flex-col p-6 space-y-6 bg-gradient-to-br from-slate-50 to-blue-50">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-4xl font-bold text-balance text-slate-900">Followup Calendar</h1>
                        <p className="text-slate-600 mt-2">Manage your sales followups and never miss an opportunity</p>
                    </div>
                </div>
                <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2 bg-blue-600 text-white hover:bg-blue-700">
                            <Filter className="h-4 w-4" />
                            View Followups
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>All Followups</DialogTitle>
                            <DialogDescription>View all missed and upcoming followups in one place</DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                            {/* Missed Followups */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5 text-red-600" />
                                    <h3 className="text-lg font-semibold text-red-700">Missed Followups ({missedFollowups.length})</h3>
                                </div>
                                <div className="space-y-3">
                                    {missedFollowups.map((followup) => (
                                        <button
                                            key={followup.id}
                                            onClick={() => setSelectedFollowup(followup)}
                                            className="w-full text-left p-4 rounded-lg bg-red-50 border border-red-200 hover:bg-red-100 transition-colors"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="space-y-1 flex-1">
                                                    <div className="font-semibold text-sm">{followup.client}</div>
                                                    <div className="text-xs text-muted-foreground">{followup.type}</div>
                                                    <div className="text-xs font-medium text-red-700">
                                                        {followup.date} at {followup.time}
                                                    </div>
                                                </div>
                                                <Badge className={`${getPriorityColor(followup.priority)}`}>{followup.priority}</Badge>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Upcoming Followups */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <Clock className="h-5 w-5 text-blue-600" />
                                    <h3 className="text-lg font-semibold text-blue-700">
                                        Upcoming Followups ({upcomingFollowups.length})
                                    </h3>
                                </div>
                                <div className="space-y-3">
                                    {upcomingFollowups.map((followup) => (
                                        <button
                                            key={followup.id}
                                            onClick={() => setSelectedFollowup(followup)}
                                            className="w-full text-left p-4 rounded-lg bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="space-y-1 flex-1">
                                                    <div className="font-semibold text-sm">{followup.client}</div>
                                                    <div className="text-xs text-muted-foreground">{followup.type}</div>
                                                    <div className="text-xs font-medium text-blue-700">
                                                        {followup.date} at {followup.time}
                                                    </div>
                                                </div>
                                                <Badge className={`${getPriorityColor(followup.priority)}`}>{followup.priority}</Badge>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <Card className="flex-1 flex flex-col bg-white border-slate-200 shadow-lg">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-3xl font-bold text-slate-900">
                                {months[currentDate.getMonth()]} {currentDate.getFullYear()}
                            </CardTitle>
                            <div className="flex gap-4 text-sm text-slate-600">
                                <span className="flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-full bg-red-500" />
                                    Missed Followups
                                </span>
                                <span className="flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                                    Upcoming Followups
                                </span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={previousMonth}
                                className="border-slate-300 hover:bg-slate-100 bg-transparent"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={nextMonth}
                                className="border-slate-300 hover:bg-slate-100 bg-transparent"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                    <div className="grid grid-cols-7 gap-3 flex-1">
                        {/* Day headers */}
                        {daysOfWeek.map((day) => (
                            <div key={day} className="text-center text-base font-semibold text-slate-700 p-3">
                                {day}
                            </div>
                        ))}

                        {/* Calendar days */}
                        {days.map((day, index) => {
                            if (!day) {
                                return <div key={`empty-${index}`} className="p-2" />
                            }

                            const dayFollowups = getFollowupsForDate(day)
                            const hasMissed = dayFollowups.some((f) => f.status === "missed")
                            const hasUpcoming = dayFollowups.some((f) => f.status === "upcoming")
                            const isSelected = selectedDate?.toDateString() === day.toDateString()
                            const isToday = new Date().toDateString() === day.toDateString()

                            return (
                                <button
                                    key={index}
                                    onClick={() => setSelectedDate(day)}
                                    className={`
                    relative p-3 rounded-lg text-base transition-all min-h-[120px] flex flex-col items-start justify-start
                    ${isSelected ? "bg-blue-100 text-slate-900 shadow-lg ring-2 ring-blue-500" : "bg-slate-50 hover:bg-slate-100 text-slate-900 border border-slate-200"}
                    ${isToday && !isSelected ? "ring-2 ring-blue-400/50" : ""}
                  `}
                                >
                                    <div className="font-semibold text-lg mb-2">{day.getDate()}</div>

                                    {dayFollowups.length > 0 && (
                                        <div className="space-y-1 w-full">
                                            {dayFollowups.map((followup) => (
                                                <button
                                                    key={followup.id}
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setSelectedFollowup(followup)
                                                    }}
                                                    className={`text-xs p-1.5 rounded truncate text-left w-full ${followup.status === "missed"
                                                        ? "bg-red-100 text-red-700 border border-red-300 hover:bg-red-200"
                                                        : "bg-blue-100 text-blue-700 border border-blue-300 hover:bg-blue-200"
                                                        }`}
                                                    title={`${followup.client} - ${followup.type} at ${followup.time}`}
                                                >
                                                    <div className="font-medium truncate">{followup.client}</div>
                                                    <div className="truncate opacity-80">{followup.type?.split(" ")[0]}</div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </CardContent>
            </Card>

            <Dialog open={!!selectedFollowup} onOpenChange={(open) => !open && setSelectedFollowup(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl cursor-pointer" onClick={() => {
                            if (selectedFollowup?.type?.split(" ")[0] == "Opportunity") {
                                router.push(`/sales/opportunites/${selectedFollowup?.id} `)
                            } else {
                                router.push(`/sales/prospects/${selectedFollowup?.id} `)
                            }
                        }
                        }>{selectedFollowup?.client}</DialogTitle>
                        <DialogDescription>{selectedFollowup?.type}</DialogDescription>
                        <div className="flex gap-3">
                            <Badge className={`${getStatusBadge(selectedFollowup?.status)} px - 3 py - 1`}>
                                {selectedFollowup?.status === "missed" ? "Missed" : "Upcoming"}
                            </Badge>
                        </div>
                    </DialogHeader>
                    {selectedFollowup && (
                        <div className="space-y-6 py-4">
                            {/* Status and Priority */}


                            {/* Date and Time */}
                            <div className="flex items-center gap-2 text-slate-700">
                                <Clock className="h-5 w-5 text-blue-600" />
                                <div>
                                    <div className="text-sm text-slate-600">Day</div>
                                    <div className="font-semibold text-slate-900">
                                        {(() => {
                                            const date = new Date(selectedFollowup.date);
                                            date.setDate(date.getDate() + 1);

                                            const day = String(date.getDate()).padStart(2, "0");
                                            const month = String(date.getMonth() + 1).padStart(2, "0");
                                            const year = date.getFullYear();

                                            return `${day}-${month}-${year}`;
                                        })()}
                                    </div>
                                </div>
                            </div>

                            {/* Phone */}
                            <div className="flex items-center gap-2">
                                <Phone className="h-5 w-5 text-blue-600" />
                                <div>
                                    <div className="text-sm text-slate-600">Phone</div>
                                    <div className="font-semibold text-slate-900">{selectedFollowup.phone}</div>
                                </div>
                            </div>

                            {/* Description */}
                            <div className="flex items-start gap-2">
                                <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
                                <div className="flex-1">
                                    <div className="text-sm text-slate-600 mb-1">Description</div>
                                    <div className="text-slate-900 leading-relaxed">{selectedFollowup.description}</div>
                                </div>
                            </div>

                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
