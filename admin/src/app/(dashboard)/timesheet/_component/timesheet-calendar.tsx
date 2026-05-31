"use client"

import { useMemo, useState, useEffect } from "react"
import { addDays } from "date-fns"
import { LogIn, LogOut } from "lucide-react"
import { TimeEntry } from "../page"

interface TimesheetCalendarProps {
  entries: TimeEntry[]
  startDate: Date
  daysToShow: number
  showLoginLogout: boolean
  onEntryClick: (entry: TimeEntry) => void
}

const timeSlots = [
  "12 AM", "1 AM", "2 AM", "3 AM", "4 AM", "5 AM",
  "6 AM", "7 AM", "8 AM", "9 AM", "10 AM", "11 AM",
  "12 PM", "1 PM", "2 PM", "3 PM", "4 PM", "5 PM",
  "6 PM", "7 PM", "8 PM", "9 PM", "10 PM", "11 PM",
]

const IST_TIME_ZONE = "Asia/Kolkata"

const getISTDayKey = (date: Date | string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(date))

  const year = parts.find((p) => p.type === "year")?.value ?? "0000"
  const month = parts.find((p) => p.type === "month")?.value ?? "01"
  const day = parts.find((p) => p.type === "day")?.value ?? "01"

  return `${year}-${month}-${day}`
}

const getISTMinutesFromMidnight = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date)

  const hours = Number(parts.find((p) => p.type === "hour")?.value ?? "0")
  const minutes = Number(parts.find((p) => p.type === "minute")?.value ?? "0")

  return hours * 60 + minutes
}

const formatISTWeekday = (date: Date) =>
  new Intl.DateTimeFormat("en-US", { timeZone: IST_TIME_ZONE, weekday: "long" }).format(date)

const formatISTDate = (date: Date) =>
  new Intl.DateTimeFormat("en-US", { timeZone: IST_TIME_ZONE, day: "numeric" }).format(date)

const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
  yellow: { bg: "bg-yellow-100", text: "text-task-yellow-foreground", border: "border" },
  toDo: { bg: "bg-yellow-100", text: "text-yellow-900", border: "border border-yellow-400" },
  pending: { bg: "bg-yellow-100", text: "text-yellow-900", border: "border border-yellow-400" },
  "in progress": { bg: "bg-blue-100", text: "text-blue-900", border: "border border-blue-400" },
  completed: { bg: "bg-green-100", text: "text-green-900", border: "border border-green-400" },
  login: { bg: "bg-green-500", text: "text-white", border: "border border-white" },
  logout: { bg: "bg-red-500", text: "text-white", border: "border border-white" },
  default: { bg: "bg-gray-100", text: "text-gray-900", border: "border border-gray-400" },
}

const logoutVariants = {
  manual: { bg: "bg-red-500", text: "text-white", border: "border border-white", label: "Logout" },
  session: { bg: "bg-amber-500", text: "text-white", border: "border border-white", label: "Session Logout" },
  force: { bg: "bg-violet-600", text: "text-white", border: "border border-white", label: "Force Logout" },
} as const

function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [time, modifier] = timeStr.split(" ")
  let [hours, minutes] = time.split(":").map(Number)
  if (modifier === "PM" && hours !== 12) hours += 12
  if (modifier === "AM" && hours === 12) hours = 0
  return { hours, minutes }
}

function getPositionAndHeight(startTime: string, endTime: string) {
  const start = parseTime(startTime)
  const end = parseTime(endTime)
  const startMinutes = start.hours * 60 + start.minutes
  const endMinutes = end.hours * 60 + end.minutes
  const top = (startMinutes / 60) * 60
  const height = Math.max(((endMinutes - startMinutes) / 60) * 60, 20)
  return { top, height }
}

type EntryLaneMeta = { laneIndex: number; laneCount: number }

function buildLoginLogoutLanes(entries: TimeEntry[]) {
  const groupedByMinute = new Map<number, TimeEntry[]>()

  entries.forEach((entry) => {
    if (entry.type !== "login" && entry.type !== "logout") return
    const parsed = parseTime(entry.startTime)
    const minuteKey = parsed.hours * 60 + parsed.minutes
    if (!groupedByMinute.has(minuteKey)) groupedByMinute.set(minuteKey, [])
    groupedByMinute.get(minuteKey)!.push(entry)
  })

  const laneMap = new Map<string, EntryLaneMeta>()

  groupedByMinute.forEach((sameMinuteEntries) => {
    const sorted = [...sameMinuteEntries].sort((a, b) => {
      if (a.type === b.type) return a.id.localeCompare(b.id)
      return a.type === "login" ? -1 : 1
    })
    const laneCount = sorted.length
    sorted.forEach((entry, laneIndex) => {
      laneMap.set(entry.id, { laneIndex, laneCount })
    })
  })

  return laneMap
}

export function TimesheetCalendar({
  entries,
  startDate,
  daysToShow,
  showLoginLogout,
  onEntryClick,
}: TimesheetCalendarProps) {
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(interval)
  }, [])

  const days = useMemo(() => {
    return Array.from({ length: daysToShow }, (_, i) => addDays(startDate, i))
  }, [startDate, daysToShow])

  const entriesByDay = useMemo(() => {
    const map = new Map<string, TimeEntry[]>()
    entries.forEach((entry) => {
      const dayKey = getISTDayKey(entry.date)
      if (!map.has(dayKey)) map.set(dayKey, [])
      map.get(dayKey)!.push(entry)
    })
    return map
  }, [entries, showLoginLogout])

  const currentTimePosition = useMemo(() => {
    const minutesFromMidnight = getISTMinutesFromMidnight(currentTime)
    return (minutesFromMidnight / 60) * 60
  }, [currentTime])

  const todayISTKey = useMemo(() => getISTDayKey(new Date()), [currentTime])

  return (
    <div className="flex-1 overflow-auto">
      <div style={{ minWidth: 800 }}>
        {/* Header */}
        <div className="sticky top-0 z-10 bg-card border-b border-border">
          <div className="grid" style={{ gridTemplateColumns: `60px repeat(${daysToShow}, 1fr)` }}>
            <div className="p-3 text-xs text-muted-foreground font-medium border-r border-border">IST</div>
            {days.map((day, index) => {
              const isToday = getISTDayKey(day) === todayISTKey
              return (
                <div
                  key={index}
                  className={`p-3 text-center border-r border-border ${isToday ? "bg-primary/5" : ""}`}
                >
                  <div className="text-xs text-muted-foreground">{formatISTWeekday(day)}</div>
                  <div className={`text-lg font-semibold ${isToday ? "text-primary" : "text-foreground"}`}>
                    {formatISTDate(day)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Time Grid */}
        <div className="relative">
          <div className="grid" style={{ gridTemplateColumns: `60px repeat(${daysToShow}, 1fr)` }}>
            {/* Time Labels */}
            <div className="border-r border-border">
              {timeSlots.map((slot, index) => (
                <div key={index} className="px-2 py-1 text-xs text-muted-foreground text-right border-b" style={{ height: 60 }}>
                  {slot}
                </div>
              ))}
            </div>

            {/* Day Columns */}
            {days.map((day, dayIndex) => {
              const dayKey = getISTDayKey(day)
              const dayEntries = entriesByDay.get(dayKey) || []
              const isToday = dayKey === todayISTKey
              const loginLogoutLanes = buildLoginLogoutLanes(dayEntries)

              return (
                <div key={dayIndex} className={`relative border-r border-border ${isToday ? "bg-primary/5" : ""}`}>
                  {/* Hour Lines */}
                  {timeSlots.map((_, index) => (
                    <div key={index} className="border-b border-border/50" style={{ height: 60 }} />
                  ))}

                  {/* Current Time Indicator */}
                  {isToday && (
                    <div
                      className="absolute left-0 right-0 flex items-center z-20 pointer-events-none"
                      style={{ top: currentTimePosition }}
                    >
                      <div className="w-2 h-2 rounded-full bg-destructive" />
                      <div className="flex-1 h-0.5 bg-destructive" />
                    </div>
                  )}

                  {/* Entries */}
                  {dayEntries.map((entry) => {
                    const { top, height } = getPositionAndHeight(entry.startTime, entry.endTime)
                    const isLoginLogout = entry.type === "login" || entry.type === "logout"
                    const lane = loginLogoutLanes.get(entry.id)
                    const logoutVariant = entry.type === "logout" ? logoutVariants[entry.logoutReason ?? "manual"] : null
                    const logoutLabel = entry.type === "logout" ? logoutVariant?.label ?? "Logout" : "Login"
                    const colors = entry.type === "logout"
                      ? logoutVariant ?? logoutVariants.manual
                      : (colorClasses[entry.status] || colorClasses.default)

                    const laneStyle = isLoginLogout && lane
                      ? {
                        left: `calc(${(lane.laneIndex * 100) / lane.laneCount}% + 4px)`,
                        width: `calc(${100 / lane.laneCount}% - 8px)`,
                      }
                      : { left: "4px", right: "4px" }

                    return (
                      <div
                        key={entry.id}
                        className={`absolute rounded-lg p-2 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg overflow-hidden ${colors.bg} ${colors.text} ${colors.border}`}
                        style={{
                          ...laneStyle,
                          top: `${top}px`,
                          height: isLoginLogout ? "28px" : `${height}px`,
                          minHeight: isLoginLogout ? "28px" : "40px",
                          zIndex: isLoginLogout ? 30 : 10,
                        }}
                        onClick={() => onEntryClick(entry)}
                      >
                        {isLoginLogout ? (
                          <div className="flex items-center gap-1.5 text-xs font-medium">
                            {entry.type === "login" ? <LogIn className="h-3 w-3" /> : <LogOut className="h-3 w-3" />}
                            <span>{entry.startTime}</span>
                            <span>{logoutLabel}</span>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between gap-1 text-xs opacity-80">
                              <span>{entry.startTime}</span>
                            </div>
                            <div className="font-medium text-sm mt-0.5 line-clamp-2">
                              <span className="opacity-80">{entry.title}</span>
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
