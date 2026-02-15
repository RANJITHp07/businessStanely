"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { addDays, startOfWeek } from "date-fns"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TimesheetFilters } from "./_component/timesheet-filters"
import { TimesheetCalendar } from "./_component/timesheet-calendar"
import { TaskDetailDialog } from "./_component/task-detail-dialog"
import type { Agent } from "@/types"

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

export default function TimesheetPage() {
    const [entries, setEntries] = useState<TimeEntry[]>([])
    const [agents, setAgents] = useState<Agent[]>([])
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
    const [selectedStatuses, setSelectedStatuses] = useState<TaskStatus[]>([])
    const [showLoginLogout, setShowLoginLogout] = useState(true)
    const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null)
    const [detailDialogOpen, setDetailDialogOpen] = useState(false)
    const [startDate, setStartDate] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
    const [daysToShow, setDaysToShow] = useState(7)

    // Fetch all agents for selection
    useEffect(() => {
        const fetchAgents = async () => {
            try {
                const response = await fetch("/api/timesheet/agents"); // Use dedicated timesheet agents endpoint
                const data = response.ok ? await response.json() : { agents: [] };
                const agentsList = (data.agents || []);
                setAgents(agentsList);
                // Default to first agent
                if (agentsList.length > 0 && !selectedAgent) {
                    console.log('[DEBUG] Setting default agent to:', agentsList[0].name);
                    setSelectedAgent(agentsList[0]);
                }
            } catch (error) {
                console.error('[DEBUG] Error fetching agents:', error);
                setAgents([]);
            }
        };
        fetchAgents();
    }, [selectedAgent]);

    const endDate = useMemo(() => addDays(startDate, daysToShow), [startDate, daysToShow])

    // Fetch timesheet data for selected agent
    useEffect(() => {
        const fetchTimesheetData = async () => {
            if (!selectedAgent) return;
            try {
                const params = new URLSearchParams({
                    agentId: selectedAgent.id,
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                });
                const response = await fetch(`/api/timesheet?${params.toString()}`);
                const data = response.ok ? await response.json() : { timeEntries: [] };
                setEntries(data.timeEntries || []);
            } catch (err) {
                console.error('[DEBUG] Error fetching timesheet data:', err);
                setEntries([]);
            }
        };
        fetchTimesheetData();
    }, [selectedAgent, startDate, endDate]);



    // Filter entries by status and date (no user filtering for admin)
    const filteredEntries = useMemo(() => {
        return entries.filter((entry) => {
            if (selectedStatuses.length > 0 && !selectedStatuses.includes(entry.status)) {
                return false;
            }
            const entryDate = new Date(entry.date).getTime();
            const start = startDate.getTime();
            const end = addDays(startDate, daysToShow).getTime();
            if (entryDate < start || entryDate >= end) {
                return false;
            }
            return true;
        });
    }, [entries, selectedStatuses, startDate, daysToShow])

    const totalHours = useMemo(() => {
        const taskEntries = filteredEntries.filter((e) => e.type === "task")
        let totalMinutes = 0

        const parseTimeToMinutes = (timeStr: string) => {
            if (!timeStr) return null
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
            if (diff < 0) diff += 24 * 60
            totalMinutes += diff
        })

        const hours = totalMinutes / 60
        return Number(hours.toFixed(2))
    }, [filteredEntries])


    // Handler for clicking an entry (show modal)
    const handleEntryClick = useCallback((entry: TimeEntry) => {
        setSelectedEntry(entry);
        setDetailDialogOpen(true);
    }, [])

    return (
        <div className="h-screen flex flex-col bg-background">
            {/* Filters */}
            <TimesheetFilters
                agents={agents}
                selectedAgent={selectedAgent}
                onSelectedAgentChange={setSelectedAgent}
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={(date) => setStartDate(addDays(date, -daysToShow + 1))}
                daysToShow={daysToShow}
                onDaysToShowChange={setDaysToShow}
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
                onEntryClick={handleEntryClick}
                showLoginLogout={showLoginLogout}
            />

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