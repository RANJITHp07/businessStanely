"use client"

import { useState } from "react"
import { format } from "date-fns"
import { CalendarIcon, ChevronDown, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { TaskStatus, Agent } from "../page"

interface TimesheetFiltersProps {
  agents: Agent[]
  selectedAgent: Agent | null
  onSelectedAgentChange: (agent: Agent) => void
  startDate: Date
  endDate: Date
  onStartDateChange: (date: Date) => void
  onEndDateChange: (date: Date) => void
  daysToShow: number
  onDaysToShowChange: (days: number) => void
  selectedStatuses: TaskStatus[]
  onSelectedStatusesChange: (statuses: TaskStatus[]) => void
  showLoginLogout: boolean
  onShowLoginLogoutChange: (show: boolean) => void
}

export function TimesheetFilters({
  agents,
  selectedAgent,
  onSelectedAgentChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  daysToShow,
  onDaysToShowChange,
  selectedStatuses,
  onSelectedStatusesChange,
}: TimesheetFiltersProps) {
  const [agentSearch, setAgentSearch] = useState("")

  const filteredAgents = agents.filter((agent) => agent.name.toLowerCase().includes(agentSearch.toLowerCase()))

  const statusOptions: { value: TaskStatus; label: string }[] = [
    { value: "completed", label: "Completed" },
    { value: "in-progress", label: "In Progress" },
    { value: "toDo", label: "To Do" },
  ]

  const toggleStatus = (status: TaskStatus) => {
    if (selectedStatuses.includes(status)) {
      onSelectedStatusesChange(selectedStatuses.filter((s) => s !== status))
    } else {
      onSelectedStatusesChange([...selectedStatuses, status])
    }
  }

  return (
    <div className="flex flex-wrap justify-between items-center gap-3 p-4  border-b border-border">
      {/* Date Range Filter */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex items-center gap-2 my-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="lg" className="h-9 gap-2 bg-transparent">
                <CalendarIcon className="h-4 w-4" />
                {format(startDate, "MMM d")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={(date) => date && onStartDateChange(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <span className="text-muted-foreground">to</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="lg" className="h-9 gap-2 bg-transparent">
                <CalendarIcon className="h-4 w-4" />
                {format(endDate, "MMM d")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={(date) => date && onEndDateChange(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Days to Show */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2 bg-transparent">
              {daysToShow} days
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {[3, 5, 7, 14].map((days) => (
              <DropdownMenuCheckboxItem
                key={days}
                checked={daysToShow === days}
                onCheckedChange={() => onDaysToShowChange(days)}
              >
                {days} days
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Agent Selector */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2 bg-transparent">
              <Search className="h-4 w-4" />
              {selectedAgent ? selectedAgent.name : "Select Agent"}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <div className="space-y-2">
              <Input
                placeholder="Search agents..."
                value={agentSearch}
                onChange={(e) => setAgentSearch(e.target.value)}
                className="h-8"
              />
              <div className="max-h-48 overflow-y-auto space-y-1">
                {filteredAgents.map((agent) => (
                  <div
                    key={agent.id}
                    className={`flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-muted ${selectedAgent?.id === agent.id ? "bg-primary/10" : ""
                      }`}
                    onClick={() => onSelectedAgentChange(agent)}
                  >
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center ${selectedAgent?.id === agent.id ? "bg-primary border-primary" : "border-border"
                        }`}
                    >
                      {selectedAgent?.id === agent.id && (
                        <span className="text-primary-foreground text-xs">✓</span>
                      )}
                    </div>
                    <span className="text-sm">{agent.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Status Filter */}
        {/* <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2 bg-transparent">
              Status
              {selectedStatuses.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 text-xs">
                  {selectedStatuses.length}
                </Badge>
              )}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="start">
            <div className="space-y-1">
              {statusOptions.map((status) => (
                <div
                  key={status.value}
                  className={`flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-muted ${selectedStatuses.includes(status.value) ? "bg-primary/10" : ""
                    }`}
                  onClick={() => toggleStatus(status.value)}
                >
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center ${selectedStatuses.includes(status.value) ? "bg-primary border-primary" : "border-border"
                      }`}
                  >
                    {selectedStatuses.includes(status.value) && (
                      <span className="text-primary-foreground text-xs">✓</span>
                    )}
                  </div>
                  <span className="text-sm">{status.label}</span>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover> */}

        {/* Clear Filters */}
        {(selectedStatuses.length > 0 || daysToShow !== 7) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 gap-1 text-muted-foreground"
            onClick={() => {
              onSelectedStatusesChange([])
              onDaysToShowChange(7)
            }}
          >
            <X className="h-4 w-4" />
            Clear
          </Button>
        )}
      </div>
      <div className="text-sm">
        Agent: <span className="font-semibold">{selectedAgent?.name || "None"}</span>
      </div>
    </div>
  )
}