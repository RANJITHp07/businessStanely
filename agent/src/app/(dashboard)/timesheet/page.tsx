"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { useAgentContext } from "@/lib/agent-context"
import { addDays, startOfWeek } from "date-fns"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TimesheetFilters } from "./_component/timesheet-filters"
import { TimesheetCalendar } from "./_component/timesheet-calendar"
import { TaskDetailDialog } from "./_component/task-detail-dialog"
import { AddEntryDialog } from "./_component/add-entry-dialog"
import type { Task, Comment } from "@/types"

const IST_TIME_ZONE = "Asia/Kolkata"
const IST_OFFSET_MINUTES = 330

const getISTDayKey = (date: Date | string) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: IST_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date(date))

    const year = Number(parts.find((part) => part.type === "year")?.value ?? "1970")
    const month = Number(parts.find((part) => part.type === "month")?.value ?? "1")
    const day = Number(parts.find((part) => part.type === "day")?.value ?? "1")

    return {
        key: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        year,
        month,
        day,
    }
}

const getISTStartOfDayISO = (date: Date) => {
    const { year, month, day } = getISTDayKey(date)
    const utcMillis = Date.UTC(year, month - 1, day, 0, 0, 0, 0) - IST_OFFSET_MINUTES * 60 * 1000
    return new Date(utcMillis).toISOString()
}

const getISTEndOfDayISO = (date: Date) => {
    const { year, month, day } = getISTDayKey(date)
    const utcMillis = Date.UTC(year, month - 1, day, 23, 59, 59, 999) - IST_OFFSET_MINUTES * 60 * 1000
    return new Date(utcMillis).toISOString()
}

export type TaskStatus = "completed" | "in-progress" | "toDo" | "pending" | "break" | "login" | "logout"

export type TaskColor = "yellow" | "coral" | "blue" | "green"

export interface TimeEntry {
    id: string
    taskId?: string
    title: string
    description: string
    project: string
    projectCode: string
    date: Date
    startTime: string
    endTime: string
    status: TaskStatus
    color: TaskColor
    userId: string
    userName: string
    type: "task" | "login" | "logout"
    logoutReason?: "manual" | "session" | "force"
}

export interface User {
    id: string
    name: string
    email: string
    avatar?: string
}

export const users: User[] = [
    { id: "1", name: "Me", email: "me@company.com" },
    { id: "2", name: "Adam Fisherman", email: "adam@company.com" },
    { id: "3", name: "Sarah Johnson", email: "sarah@company.com" },
    { id: "4", name: "Mike Chen", email: "mike@company.com" },
]

export const sampleTimeEntries: TimeEntry[] = [
    // No dummy data, will fetch real data
]

export default function TimesheetPage() {
    const [entries, setEntries] = useState<TimeEntry[]>([])
    const [users, setUsers] = useState<User[]>([])
    const [selectedUsers, setSelectedUsers] = useState<User[]>([])
    const [selectedStatuses, setSelectedStatuses] = useState<TaskStatus[]>([])
    const [showLoginLogout, setShowLoginLogout] = useState(true)
    const [addDialogOpen, setAddDialogOpen] = useState(false)
    const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null)
    const [detailDialogOpen, setDetailDialogOpen] = useState(false)
    const [startDate, setStartDate] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
    const [daysToShow, setDaysToShow] = useState(7)
    const agent = useAgentContext();

    // Fetch agent and team members for filter
    useEffect(() => {
        const fetchUsers = async () => {
            if (!agent) return;
            try {
                // Fetch team members (subordinates)
                const res = await fetch("/api/team-members");
                const team = res.ok ? await res.json() : [];
                // Build users list: Me + team
                const me: User = { id: agent.id, name: "Me", email: agent.email };
                const teammates: User[] = (team || []).map((tm: { id: string, name: string, email: string }) => ({ id: tm.id, name: tm.name, email: tm.email }));
                setUsers([me, ...teammates]);
                setSelectedUsers([me]); // Default to "Me"
            } catch {
                setUsers([]);
            }
        };
        fetchUsers();
    }, [agent]);

    const endDate = useMemo(() => addDays(startDate, daysToShow - 1), [startDate, daysToShow])

    const fetchTimesheetData = useCallback(async () => {
        if (!agent || selectedUsers.length === 0) return;
        try {
            const userIds = selectedUsers.map(u => u.id);
            const params = new URLSearchParams({
                assignedToIds: userIds.join(","),
                startDate: getISTStartOfDayISO(startDate),
                endDate: getISTEndOfDayISO(endDate),
            });
            const response = await fetch(`/api/timesheet?${params.toString()}`);
            const data = response.ok ? await response.json() : { timeEntries: [] };
            setEntries(data.timeEntries || []);
        } catch {
            setEntries([]);
        }
    }, [agent, selectedUsers, startDate, endDate]);

    useEffect(() => {
        fetchTimesheetData();
    }, [fetchTimesheetData]);

    // Filter entries by selected users, status, and date
    const filteredEntries = useMemo(() => {
        return entries
    }, [entries, selectedUsers, selectedStatuses, startDate, daysToShow])


    const totalHours = useMemo(() => {
        const taskEntries = filteredEntries.filter((e) => e.type === "task")
        let totalMinutes = 0

        const parseTimeToMinutes = (timeStr: string) => {
            if (!timeStr) return null
            // Handle formats: "HH:MM", "HH:MM AM/PM", "H:MM AM/PM"
            const ampmMatch = timeStr.match(/(am|pm)$/i)
            let hours = 0
            let minutes = 0
            if (ampmMatch) {
                const cleaned = timeStr.replace(/\s*(am|pm)$/i, "")
                const parts = cleaned.split(":").map((p) => p.trim())
                hours = Number(parts[0] || 0)
                minutes = Number(parts[1] || 0)
                const isPM = /pm/i.test(ampmMatch[0])
                if (isPM && hours < 12) hours += 12
                if (!isPM && hours === 12) hours = 0
            } else {
                const parts = timeStr.split(":").map((p) => p.trim())
                hours = Number(parts[0] || 0)
                minutes = Number(parts[1] || 0)
            }
            if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
            return hours * 60 + minutes
        }

        taskEntries.forEach((entry) => {
            const startMin = parseTimeToMinutes(entry.startTime)
            const endMin = parseTimeToMinutes(entry.endTime)
            if (startMin == null || endMin == null) return
            let diff = endMin - startMin
            // if end before start, assume spans midnight
            if (diff < 0) diff += 24 * 60
            totalMinutes += diff
        })

        const hours = totalMinutes / 60
        return Number(hours.toFixed(2))
    }, [filteredEntries])

    const handleAddEntry = useCallback((newEntry: TimeEntry) => {
        setEntries((prev) => [...prev, newEntry])
        fetchTimesheetData()
    }, [fetchTimesheetData])

    // Handler for clicking an entry (show modal)
    const handleEntryClick = useCallback((entry: TimeEntry) => {
        setSelectedEntry(entry);
        setDetailDialogOpen(true);
    }, [])


    return (
        <div className="h-screen flex flex-col bg-background">
            {/* Header */}
            {/* <TimesheetHeader
                startDate={startDate}
                totalHours={totalHours}
                onPrevious={handlePrevious}
                onNext={handleNext}
                onToday={handleToday}
            /> */}

            {/* Filters */}
            <TimesheetFilters
                users={users}
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={(date) => setStartDate(addDays(date, -daysToShow + 1))}
                daysToShow={daysToShow}
                onDaysToShowChange={setDaysToShow}
                selectedUsers={selectedUsers}
                onSelectedUsersChange={setSelectedUsers}
                selectedStatuses={selectedStatuses}
                onSelectedStatusesChange={setSelectedStatuses}
                showLoginLogout={showLoginLogout}
                onShowLoginLogoutChange={setShowLoginLogout}
                totalHours={totalHours}
            />

            {/* Calendar */}
            <TimesheetCalendar
                entries={filteredEntries}
                startDate={startDate}
                daysToShow={daysToShow}
                onEntryClick={handleEntryClick}
                showLoginLogout={true}
            // showTaskName removed, not in props
            />

            {/* Floating Add Button */}
            <Button
                size="lg"
                className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg"
                onClick={() => setAddDialogOpen(true)}
            >
                <Plus className="h-6 w-6" />
            </Button>

            {/* Dialogs */}
            <AddEntryDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} onAddEntry={handleAddEntry} />

            {/* Modal for comment details */}
            {selectedEntry && (
                <TaskDetailDialog
                    open={detailDialogOpen}
                    onOpenChange={setDetailDialogOpen}
                    entry={selectedEntry}
                />
            )}
        </div>
    )
}