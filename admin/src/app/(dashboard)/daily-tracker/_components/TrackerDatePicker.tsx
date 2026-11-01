"use client"

import { useState } from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { istDateKey } from "@/lib/dailyTrack"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

/** "YYYY-MM-DD" as a local Date at midnight, so the calendar highlights that day. */
function keyToDate(dateKey: string) {
    const [y, m, d] = dateKey.split("-").map(Number)
    return new Date(y, m - 1, d)
}

/** Date picker for the tracker pages; days after today (IST) cannot be picked. */
export function TrackerDatePicker({
    value,
    onChange,
}: {
    value: string
    onChange: (dateKey: string) => void
}) {
    const [open, setOpen] = useState(false)
    const selected = keyToDate(value)
    const today = istDateKey()

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(selected, "dd MMM yyyy")}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                    mode="single"
                    selected={selected}
                    defaultMonth={selected}
                    onSelect={(day) => {
                        if (!day) return
                        onChange(format(day, "yyyy-MM-dd"))
                        setOpen(false)
                    }}
                    disabled={(day) => format(day, "yyyy-MM-dd") > today}
                    autoFocus
                />
            </PopoverContent>
        </Popover>
    )
}
