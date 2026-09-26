"use client"
import { useEffect, useState } from "react"
import { Check, Filter, X } from "lucide-react"
import { fetchWithAuth } from "@/lib/fetchWithAuth"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

type Service = { id: string; name: string }

// Searchable multi-select over task categories ("services"). Empty selection
// means all services.
export default function ServiceFilter({
  selectedIds,
  onChange,
}: {
  selectedIds: string[]
  onChange: (ids: string[]) => void
}) {
  const [services, setServices] = useState<Service[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetchWithAuth("/api/task-categories?lite=true")
        if (!response.ok) return
        const data: Service[] = await response.json()
        setServices(data)
      } catch (error) {
        console.error("Error fetching services:", error)
      }
    }
    load()
  }, [])

  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((s) => s !== id)
        : [...selectedIds, id],
    )
  }

  const nameOf = (id: string) => services.find((s) => s.id === id)?.name ?? "Service"

  return (
    <div className="space-y-2">
      <Label>Service</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-between font-normal">
            {selectedIds.length ? `${selectedIds.length} selected` : "All Services"}
            <Filter className="ml-2 h-4 w-4 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search service..." />
            <CommandList>
              <CommandEmpty>No service found.</CommandEmpty>
              <CommandGroup>
                <CommandItem value="__all__" onSelect={() => onChange([])}>
                  <Check
                    className={cn("mr-2 h-4 w-4", selectedIds.length === 0 ? "opacity-100" : "opacity-0")}
                  />
                  All Services
                </CommandItem>
                {services.map((service) => (
                  <CommandItem
                    key={service.id}
                    value={`${service.name} ${service.id}`}
                    onSelect={() => toggle(service.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedIds.includes(service.id) ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {service.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 justify-end">
          {selectedIds.map((id) => (
            <Badge key={id} variant="secondary" className="px-2 py-1">
              <span>{nameOf(id)}</span>
              <button
                type="button"
                aria-label={`Remove ${nameOf(id)}`}
                className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded hover:bg-muted/70"
                onClick={() => onChange(selectedIds.filter((s) => s !== id))}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
