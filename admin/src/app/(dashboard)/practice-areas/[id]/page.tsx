"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "react-toastify"
import {
    ArrowDown,
    ArrowLeft,
    ArrowUp,
    Edit,
    Filter,
    MoreHorizontal,
    Plus,
    Search,
    SlidersHorizontal,
    Trash2,
} from "lucide-react"
import { fetchWithAuth } from "@/lib/fetchWithAuth"
import {
    effectiveAttachmentMode,
    MAX_ATTACHMENTS_LIMIT,
    PARAMETER_TYPES,
    parameterTypeLabel,
    type DefinitionInput,
    type PracticeAreaParameterDefinition,
} from "@/lib/practiceAreaParameters"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import ParameterDialog from "../_components/ParameterDialog"
import PracticeAreaIcon from "../_components/PracticeAreaIcon"

type ParameterRow = PracticeAreaParameterDefinition & { usageCount: number }

interface PracticeAreaDetail {
    id: string
    title: string
    description?: string | null
    icon: string
    active: boolean
    enquiryCount: number
    createdAt: string
    parameters: ParameterRow[]
}

type RequiredFilter = "all" | "required" | "optional"

function describeAttachments(param: PracticeAreaParameterDefinition) {
    const mode = effectiveAttachmentMode(param)
    if (mode === "DISABLED") return "Disabled"
    const label = mode === "REQUIRED" ? "Required" : "Optional"
    return `${label} · max ${param.maxAttachments ?? MAX_ATTACHMENTS_LIMIT}`
}

export default function PracticeAreaDetailPage() {
    const { id } = useParams<{ id: string }>()
    const router = useRouter()
    const [area, setArea] = useState<PracticeAreaDetail | null>(null)
    const [loading, setLoading] = useState(true)

    const [searchTerm, setSearchTerm] = useState("")
    const [typeFilter, setTypeFilter] = useState("all")
    const [requiredFilter, setRequiredFilter] = useState<RequiredFilter>("all")

    const [dialogOpen, setDialogOpen] = useState(false)
    const [editing, setEditing] = useState<ParameterRow | null>(null)
    const [saving, setSaving] = useState(false)
    const [parameterToDelete, setParameterToDelete] = useState<ParameterRow | null>(null)
    const [reordering, setReordering] = useState(false)

    const loadArea = useCallback(async () => {
        try {
            const res = await fetchWithAuth(`/api/practice-areas/${id}`, { cache: "no-store" })
            if (res.status === 404) {
                toast.error("Practice area not found")
                router.push("/practice-areas")
                return
            }
            if (!res.ok) throw new Error(`Failed to load parameter area: ${res.status}`)
            setArea(await res.json())
        } catch (error) {
            console.error("Error loading parameter area:", error)
            toast.error("Failed to load parameter area")
        } finally {
            setLoading(false)
        }
    }, [id, router])

    useEffect(() => {
        loadArea()
    }, [loadArea])

    const parameters = area?.parameters ?? []
    const filteredParameters = parameters.filter((param) => {
        if (searchTerm.trim() && !param.title.toLowerCase().includes(searchTerm.trim().toLowerCase())) {
            return false
        }
        if (typeFilter !== "all" && param.type !== typeFilter) return false
        if (requiredFilter === "required" && !param.required) return false
        if (requiredFilter === "optional" && param.required) return false
        return true
    })
    const isFiltered = Boolean(searchTerm.trim()) || typeFilter !== "all" || requiredFilter !== "all"

    const openCreate = () => {
        setEditing(null)
        setDialogOpen(true)
    }

    const openEdit = (param: ParameterRow) => {
        setEditing(param)
        setDialogOpen(true)
    }

    const handleSave = async (definition: DefinitionInput) => {
        setSaving(true)
        try {
            const res = await fetchWithAuth(
                editing
                    ? `/api/practice-areas/${id}/parameters/${editing.id}`
                    : `/api/practice-areas/${id}/parameters`,
                {
                    method: editing ? "PUT" : "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(definition),
                },
            )
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                toast.error(data.error || "Failed to save parameter")
                return
            }
            toast.success(editing ? "Parameter updated" : "Parameter added")
            setDialogOpen(false)
            await loadArea()
        } catch (error) {
            console.error("Error saving parameter:", error)
            toast.error("An unexpected error occurred")
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!parameterToDelete) return
        try {
            const res = await fetchWithAuth(`/api/practice-areas/${id}/parameters/${parameterToDelete.id}`, {
                method: "DELETE",
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                toast.error(data.error || "Failed to remove parameter")
                return
            }
            toast.success("Parameter removed")
            setParameterToDelete(null)
            await loadArea()
        } catch {
            toast.error("Failed to remove parameter")
        }
    }

    const moveParameter = async (index: number, direction: -1 | 1) => {
        if (!area) return
        const target = index + direction
        if (target < 0 || target >= parameters.length) return
        const next = [...parameters]
        ;[next[index], next[target]] = [next[target], next[index]]
        const previous = area
        setArea({ ...area, parameters: next })
        setReordering(true)
        try {
            const res = await fetchWithAuth(`/api/practice-areas/${id}/parameters/reorder`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderedIds: next.map((p) => p.id) }),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || "Failed to reorder parameters")
            }
        } catch (error) {
            setArea(previous)
            toast.error(error instanceof Error ? error.message : "Failed to reorder parameters")
            if (error instanceof Error && error.message.includes("Refresh")) loadArea()
        } finally {
            setReordering(false)
        }
    }

    if (loading || !area) {
        return (
            <div className="container mx-auto p-6 max-w-7xl space-y-6">
                <Skeleton className="h-10 w-72" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        )
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <Button
                        variant="ghost"
                        className="-ml-3 mb-2 text-muted-foreground"
                        onClick={() => router.push("/practice-areas")}
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Parameter Areas
                    </Button>
                    <h1 className="text-[28px] md:text-3xl font-bold flex items-center gap-3">
                        <span className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
                            <PracticeAreaIcon icon={area.icon} className="h-5 w-5" />
                        </span>
                        {area.title}
                    </h1>
                </div>
                <Button variant="outline" onClick={() => router.push(`/practice-areas/${id}/edit`)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Parameter Area
                </Button>
            </div>

            <Card className="mb-8">
                <CardHeader>
                    <CardTitle>Parameter Area Information</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-3">
                            <Label className="text-sm font-medium text-muted-foreground">Description</Label>
                            <p className="mt-1">{area.description || "—"}</p>
                        </div>
                        <div>
                            <Label className="text-sm font-medium text-muted-foreground">Website Status</Label>
                            <div className="mt-1">
                                {area.active ? (
                                    <Badge className="bg-green-100 text-green-800 border-green-200 border">Shown</Badge>
                                ) : (
                                    <Badge variant="secondary">Hidden</Badge>
                                )}
                            </div>
                        </div>
                        <div>
                            <Label className="text-sm font-medium text-muted-foreground">Enquiries</Label>
                            <p className="mt-1 font-medium">{area.enquiryCount}</p>
                        </div>
                        <div>
                            <Label className="text-sm font-medium text-muted-foreground">Created</Label>
                            <p className="mt-1 font-medium">
                                {new Date(area.createdAt).toLocaleDateString("en-US", {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                })}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="mb-8">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Filter className="h-5 w-5" />
                        Filters & Search
                    </CardTitle>
                    <CardDescription>Filter this parameter area&apos;s parameters</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <Label htmlFor="parameter-search">Search</Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="parameter-search"
                                    placeholder="Search by title..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label>Type</Label>
                            <Select value={typeFilter} onValueChange={setTypeFilter}>
                                <SelectTrigger className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All types</SelectItem>
                                    {PARAMETER_TYPES.map((t) => (
                                        <SelectItem key={t.value} value={t.value}>
                                            {t.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label>Required</Label>
                            <Select value={requiredFilter} onValueChange={(v) => setRequiredFilter(v as RequiredFilter)}>
                                <SelectTrigger className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All</SelectItem>
                                    <SelectItem value="required">Required</SelectItem>
                                    <SelectItem value="optional">Optional</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <Button
                            className="cursor-pointer hover:text-white text-white bg-[#f42b03] hover:bg-[#f42b03] rounded-lg px-4 py-2 shadow-none hover:shadow-lg transition-shadow duration-300"
                            variant="outline"
                            onClick={() => {
                                setSearchTerm("")
                                setTypeFilter("all")
                                setRequiredFilter("all")
                            }}
                        >
                            Clear
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <SlidersHorizontal className="h-5 w-5" />
                                Parameters ({filteredParameters.length})
                            </CardTitle>
                            <CardDescription className="mt-1.5">
                                {isFiltered
                                    ? "Clear the filters to change the order."
                                    : "Clients fill these in, in this order, on their request in the client portal"}
                            </CardDescription>
                        </div>
                        <Button
                            onClick={openCreate}
                            className="bg-[#003459] hover:bg-[#003459] text-white rounded-lg px-4 py-2 flex items-center gap-2 cursor-pointer shadow-none hover:shadow-md transition-shadow duration-300"
                        >
                            <Plus className="h-4 w-4" />
                            Add Parameter
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12">#</TableHead>
                                    <TableHead>Title</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Required</TableHead>
                                    <TableHead>Attachments</TableHead>
                                    <TableHead>Answers</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredParameters.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center h-32">
                                            {parameters.length === 0
                                                ? "No parameters yet. Clients will not be asked for anything extra for this parameter area."
                                                : "No parameters match the filters"}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredParameters.map((param) => {
                                        const index = parameters.indexOf(param)
                                        return (
                                            <TableRow key={param.id}>
                                                <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                                                <TableCell className="font-medium">{param.title}</TableCell>
                                                <TableCell>
                                                    <div>{parameterTypeLabel(param.type)}</div>
                                                    {param.type === "SELECT" && (
                                                        <div
                                                            className="text-xs text-muted-foreground max-w-[220px] truncate"
                                                            title={param.options.join(", ")}
                                                        >
                                                            {param.options.join(", ")}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {param.required ? (
                                                        <Badge className="bg-red-100 text-red-800 border-red-200 border">Required</Badge>
                                                    ) : (
                                                        <Badge variant="secondary">Optional</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>{describeAttachments(param)}</TableCell>
                                                <TableCell>{param.usageCount}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {!isFiltered && (
                                                            <>
                                                                <Button
                                                                    variant="ghost"
                                                                    className="h-8 w-8 p-0"
                                                                    disabled={reordering || index === 0}
                                                                    onClick={() => moveParameter(index, -1)}
                                                                    aria-label="Move up"
                                                                >
                                                                    <ArrowUp className="h-4 w-4" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    className="h-8 w-8 p-0"
                                                                    disabled={reordering || index === parameters.length - 1}
                                                                    onClick={() => moveParameter(index, 1)}
                                                                    aria-label="Move down"
                                                                >
                                                                    <ArrowDown className="h-4 w-4" />
                                                                </Button>
                                                            </>
                                                        )}
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                                    <span className="sr-only">Open menu</span>
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem onClick={() => openEdit(param)}>
                                                                    <Edit className="mr-2 h-4 w-4" />
                                                                    Edit
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    onClick={() => setParameterToDelete(param)}
                                                                    className="text-red-600"
                                                                >
                                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                                    Delete
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <ParameterDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                initial={editing}
                usageCount={editing?.usageCount ?? 0}
                areaTitle={area.title}
                saving={saving}
                onSave={handleSave}
            />

            <AlertDialog open={!!parameterToDelete} onOpenChange={() => setParameterToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove this parameter?</AlertDialogTitle>
                        <AlertDialogDescription>
                            &quot;{parameterToDelete?.title}&quot; will no longer be asked for in the client portal.
                            {(parameterToDelete?.usageCount ?? 0) > 0 &&
                                ` Answers already saved on ${parameterToDelete?.usageCount} enquir${parameterToDelete?.usageCount === 1 ? "y" : "ies"} are kept.`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                            Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
