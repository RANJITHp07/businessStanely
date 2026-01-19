"use client"

import { useState, useMemo, useCallback } from "react"
import { addDays, startOfWeek } from "date-fns"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TimesheetFilters } from "./_component/timesheet-filters"
import { TimesheetHeader } from "./_component/timesheet-header"
import { TimesheetCalendar } from "./_component/timesheet-calendar"
import { AddEntryDialog } from "./_component/add-entry-dialog"
import { TaskDetailDialog } from "./_component/task-detail-dialog"

export type TaskStatus = "completed" | "in-progress" | "toDo" | "login" | "logout"

export type TaskColor = "yellow" | "coral" | "blue" | "green"

export interface TimeEntry {
    id: string
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
    {
        id: "1",
        title: "Code review",
        description: "Review PRs for the authentication module",
        project: "Basgram",
        projectCode: "PR58",
        date: new Date(2026, 0, 12),
        startTime: "08:12",
        endTime: "10:30",
        status: "completed",
        color: "yellow",
        userId: "1",
        userName: "Me",
        type: "task",
    },
    {
        id: "2",
        title: "Changes in notifications",
        description: "Update notification system for better UX",
        project: "Basgram",
        projectCode: "PR58",
        date: new Date(2026, 0, 14),
        startTime: "08:12",
        endTime: "12:00",
        status: "in-progress",
        color: "coral",
        userId: "1",
        userName: "Me",
        type: "task",
    },
    {
        id: "3",
        title: "Setup",
        description: "Initial project configuration",
        project: "Huntswood",
        projectCode: "PR689",
        date: new Date(2026, 0, 13),
        startTime: "09:45",
        endTime: "12:00",
        status: "completed",
        color: "yellow",
        userId: "1",
        userName: "Me",
        type: "task",
    },
    {
        id: "4",
        title: "Disable agenda prefiltering",
        description: "Remove automatic filtering for agenda view",
        project: "Allgon",
        projectCode: "PR489",
        date: new Date(2026, 0, 15),
        startTime: "08:25",
        endTime: "12:30",
        status: "toDo",
        color: "coral",
        userId: "1",
        userName: "Me",
        type: "task",
    },
    {
        id: "5",
        title: "Extended share feature",
        description: "Add sharing functionality to posts",
        project: "Basgram",
        projectCode: "PR58",
        date: new Date(2026, 0, 12),
        startTime: "13:08",
        endTime: "15:30",
        status: "completed",
        color: "coral",
        userId: "1",
        userName: "Me",
        type: "task",
    },
    {
        id: "7",
        title: "Fix importer",
        description: "Debug and fix data import issues",
        project: "Allgon",
        projectCode: "PR489",
        date: new Date(2026, 0, 13),
        startTime: "15:25",
        endTime: "18:00",
        status: "in-progress",
        color: "blue",
        userId: "1",
        userName: "Me",
        type: "task",
    },
    {
        id: "8",
        title: "Morning Login",
        description: "Started work",
        project: "System",
        projectCode: "LOGIN",
        date: new Date(2026, 0, 12),
        startTime: "08:00",
        endTime: "08:00",
        status: "login",
        color: "green",
        userId: "1",
        userName: "Me",
        type: "login",
    },
    {
        id: "9",
        title: "Evening Logout",
        description: "Ended work",
        project: "System",
        projectCode: "LOGOUT",
        date: new Date(2026, 0, 12),
        startTime: "18:00",
        endTime: "18:00",
        status: "logout",
        color: "green",
        userId: "1",
        userName: "Me",
        type: "logout",
    },
    {
        id: "10",
        title: "Morning Login",
        description: "Started work",
        project: "System",
        projectCode: "LOGIN",
        date: new Date(2026, 0, 13),
        startTime: "09:30",
        endTime: "09:30",
        status: "login",
        color: "green",
        userId: "1",
        userName: "Me",
        type: "login",
    },
    {
        id: "11",
        title: "Lunch Logout",
        description: "Break",
        project: "System",
        projectCode: "LOGOUT",
        date: new Date(2026, 0, 13),
        startTime: "12:30",
        endTime: "12:30",
        status: "logout",
        color: "green",
        userId: "1",
        userName: "Me",
        type: "logout",
    },
    {
        id: "13",
        title: "Evening Logout",
        description: "Ended work",
        project: "System",
        projectCode: "LOGOUT",
        date: new Date(2026, 0, 13),
        startTime: "19:00",
        endTime: "19:00",
        status: "logout",
        color: "green",
        userId: "1",
        userName: "Me",
        type: "logout",
    },
    // Adam's entries
    {
        id: "14",
        title: "API Development",
        description: "Build REST endpoints",
        project: "Backend",
        projectCode: "BE101",
        date: new Date(2026, 0, 14),
        startTime: "09:00",
        endTime: "12:00",
        status: "completed",
        color: "blue",
        userId: "2",
        userName: "Adam Fisherman",
        type: "task",
    },
    {
        id: "14",
        title: "API Development",
        description: "Build REST endpoints",
        project: "Backend",
        projectCode: "BE101",
        date: new Date(2026, 0, 14),
        startTime: "09:00",
        endTime: "12:00",
        status: "completed",
        color: "blue",
        userId: "2",
        userName: "Adam Fisherman",
        type: "task",
    },
    {
        id: "15",
        title: "Morning Login",
        description: "Started work",
        project: "System",
        projectCode: "LOGIN",
        date: new Date(2026, 0, 14),
        startTime: "08:45",
        endTime: "08:45",
        status: "login",
        color: "green",
        userId: "2",
        userName: "Adam Fisherman",
        type: "login",
    },
]


export default function TimesheetPage() {
    const [entries, setEntries] = useState<TimeEntry[]>(sampleTimeEntries)
    const [startDate, setStartDate] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
    const [daysToShow, setDaysToShow] = useState(7)
    const [selectedUsers, setSelectedUsers] = useState<User[]>([users[0]]) // Default to "Me"
    const [selectedStatuses, setSelectedStatuses] = useState<TaskStatus[]>([])
    const [showLoginLogout, setShowLoginLogout] = useState(true)
    const [addDialogOpen, setAddDialogOpen] = useState(false)
    const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null)
    const [detailDialogOpen, setDetailDialogOpen] = useState(false)

    const endDate = useMemo(() => addDays(startDate, daysToShow - 1), [startDate, daysToShow])

    // Filter entries
    const filteredEntries = useMemo(() => {
        return entries.filter((entry) => {
            // Filter by selected users
            if (selectedUsers.length > 0 && !selectedUsers.find((u) => u.id === entry.userId)) {
                return false
            }

            // Filter by status
            if (selectedStatuses.length > 0 && !selectedStatuses.includes(entry.status)) {
                return false
            }

            // Filter by date range
            const entryDate = entry.date.getTime()
            const start = startDate.getTime()
            const end = addDays(startDate, daysToShow).getTime()
            if (entryDate < start || entryDate >= end) {
                return false
            }

            return true
        })
    }, [entries, selectedUsers, selectedStatuses, startDate, daysToShow])

    // Calculate total hours
    const totalHours = useMemo(() => {
        const taskEntries = filteredEntries.filter((e) => e.type === "task")
        let totalMinutes = 0

        taskEntries.forEach((entry) => {
            const [startH, startM] = entry.startTime.split(":").map(Number)
            const [endH, endM] = entry.endTime.split(":").map(Number)
            totalMinutes += endH * 60 + endM - (startH * 60 + startM)
        })

        return Math.round(totalMinutes / 60)
    }, [filteredEntries])

    const handleAddEntry = useCallback((newEntry: Omit<TimeEntry, "id">) => {
        const id = `${Date.now()}`
        setEntries((prev) => [...prev, { ...newEntry, id }])
    }, [])

    const handleEntryClick = useCallback((entry: TimeEntry) => {
        setSelectedEntry(entry)
        setDetailDialogOpen(true)
    }, [])

    const handlePrevious = useCallback(() => {
        setStartDate((prev) => addDays(prev, -daysToShow))
    }, [daysToShow])

    const handleNext = useCallback(() => {
        setStartDate((prev) => addDays(prev, daysToShow))
    }, [daysToShow])

    const handleToday = useCallback(() => {
        setStartDate(startOfWeek(new Date(), { weekStartsOn: 1 }))
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
            />

            {/* Calendar */}
            <TimesheetCalendar
                entries={filteredEntries}
                startDate={startDate}
                daysToShow={daysToShow}
                showLoginLogout={showLoginLogout}
                onEntryClick={handleEntryClick}
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

            <TaskDetailDialog entry={selectedEntry} open={detailDialogOpen} onOpenChange={setDetailDialogOpen} />
        </div>
    )
}
