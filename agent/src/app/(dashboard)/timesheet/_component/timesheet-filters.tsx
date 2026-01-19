"use client"

import { useState } from "react"
import { format } from "date-fns"
import { CalendarIcon, ChevronDown, Search, X, LogIn, LogOut } from "lucide-react"
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
import { TaskStatus, User, users } from "../page"

interface TimesheetFiltersProps {
  startDate: Date
  endDate: Date
  onStartDateChange: (date: Date) => void
  onEndDateChange: (date: Date) => void
  daysToShow: number
  onDaysToShowChange: (days: number) => void
  selectedUsers: User[]
  onSelectedUsersChange: (users: User[]) => void
  selectedStatuses: TaskStatus[]
  onSelectedStatusesChange: (statuses: TaskStatus[]) => void
  showLoginLogout: boolean
  onShowLoginLogoutChange: (show: boolean) => void
}

export function TimesheetFilters({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  daysToShow,
  onDaysToShowChange,
  selectedUsers,
  onSelectedUsersChange,
  selectedStatuses,
  onSelectedStatusesChange,
  showLoginLogout,
  onShowLoginLogoutChange,
}: TimesheetFiltersProps) {
  const [userSearch, setUserSearch] = useState("")

  const filteredUsers = users.filter((user) => user.name.toLowerCase().includes(userSearch.toLowerCase()))

  const statusOptions: { value: TaskStatus; label: string }[] = [
    { value: "completed", label: "Completed" },
    { value: "in-progress", label: "In Progress" },
    { value: "pending", label: "Pending" },
    { value: "break", label: "Break" },
  ]

  const toggleUser = (user: User) => {
    if (selectedUsers.find((u) => u.id === user.id)) {
      onSelectedUsersChange(selectedUsers.filter((u) => u.id !== user.id))
    } else {
      onSelectedUsersChange([...selectedUsers, user])
    }
  }

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
            {[3, 5, 7, 14, 30].map((days) => (
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

        {/* User Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2 bg-transparent">
              <Search className="h-4 w-4" />
              {selectedUsers.length === 0
                ? "All Users"
                : selectedUsers.length === 1
                  ? selectedUsers[0].name
                  : `${selectedUsers.length} users`}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <div className="space-y-2">
              <Input
                placeholder="Search users..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="h-8"
              />
              <div className="max-h-48 overflow-y-auto space-y-1">
                {filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className={`flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-muted ${selectedUsers.find((u) => u.id === user.id) ? "bg-primary/10" : ""
                      }`}
                    onClick={() => toggleUser(user)}
                  >
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center ${selectedUsers.find((u) => u.id === user.id) ? "bg-primary border-primary" : "border-border"
                        }`}
                    >
                      {selectedUsers.find((u) => u.id === user.id) && (
                        <span className="text-primary-foreground text-xs">✓</span>
                      )}
                    </div>
                    <span className="text-sm">{user.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>


        {/* Clear Filters */}
        {
          (selectedUsers.length > 0 || selectedStatuses.length > 0 || daysToShow !== 7) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 gap-1 text-muted-foreground"
              onClick={() => {
                onSelectedUsersChange([users[0]])
                onSelectedStatusesChange([])
                onDaysToShowChange(7)
              }}
            >
              <X className="h-4 w-4" />
              Clear
            </Button>
          )
        }
      </div>
      <div className="text-sm">
        Worked this week: <span className="font-semibold">{24} hours</span>
      </div>
    </div >
  )
}
