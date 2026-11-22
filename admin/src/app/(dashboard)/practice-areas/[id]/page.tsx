"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "react-toastify"
import { ArrowLeft, CornerDownRight, Edit, Filter, Repeat, Search, SlidersHorizontal } from "lucide-react"
import { fetchWithAuth } from "@/lib/fetchWithAuth"
import {
    effectiveAttachmentMode,
    MAX_ATTACHMENTS_LIMIT,
    PARAMETER_TYPES,
    parameterTypeLabel,
    type ParameterTree,
    type PracticeAreaParameterDefinition,
} from "@/lib/practiceAreaParameters"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import PracticeAreaIcon from "../_components/PracticeAreaIcon"

type ParameterRow = PracticeAreaParameterDefinition & { usageCount: number }
type ParameterNode = ParameterTree<ParameterRow>

/** A parameter or sub-parameter as one table row. */
interface DisplayRow {
    param: ParameterRow
    depth: number
    number: string
    /** Title of the sibling a COUNT parameter reads its number from. */
    countSource: string | null
}

function toRows(list: ParameterNode[], depth = 1, prefix = ""): DisplayRow[] {
    return list.flatMap((param, index) => {
        const number = `${prefix}${index + 1}`
        const source = list.find((s) => s.id === param.countParameterId)
        return [
            { param, depth, number, countSource: source?.title ?? null },
            ...toRows(param.children, depth + 1, `${number}.`),
        ]
    })
}

interface PracticeAreaDetail {
    id: string
    title: string
    description?: string | null
    icon: string
    active: boolean
    enquiryCount: number
    createdAt: string
    parameters: ParameterNode[]
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

    const rows = toRows(area?.parameters ?? [])
    const filteredRows = rows.filter(({ param }) => {
        if (searchTerm.trim() && !param.title.toLowerCase().includes(searchTerm.trim().toLowerCase())) {
            return false
        }
        if (typeFilter !== "all" && param.type !== typeFilter) return false
        if (requiredFilter === "required" && !param.required) return false
        if (requiredFilter === "optional" && param.required) return false
        return true
    })

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
                                Parameters ({filteredRows.length})
                            </CardTitle>
                            <CardDescription className="mt-1.5">
                                Clients fill these in, in this order, on their request in the client portal.
                                Sub-parameters are indented under their group.
                            </CardDescription>
                        </div>
                        <Button
                            onClick={() => router.push(`/practice-areas/${id}/edit`)}
                            className="bg-[#003459] hover:bg-[#003459] text-white rounded-lg px-4 py-2 flex items-center gap-2 cursor-pointer shadow-none hover:shadow-md transition-shadow duration-300"
                        >
                            <Edit className="h-4 w-4" />
                            Edit Parameters
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
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredRows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center h-32">
                                            {rows.length === 0
                                                ? "No parameters yet. Clients will not be asked for anything extra for this parameter area."
                                                : "No parameters match the filters"}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredRows.map(({ param, depth, number, countSource }) => (
                                        <TableRow key={param.id} className={depth > 1 ? "bg-muted/30" : undefined}>
                                            <TableCell className="text-muted-foreground">{number}</TableCell>
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-1" style={{ paddingLeft: (depth - 1) * 20 }}>
                                                    {depth > 1 && (
                                                        <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                                    )}
                                                    {param.title}
                                                </div>
                                            </TableCell>
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
                                                {param.repeat !== "NONE" && (
                                                    <div className="mt-0.5 flex items-center gap-1 text-xs text-blue-700">
                                                        <Repeat className="h-3 w-3 shrink-0" />
                                                        {param.repeat === "MULTIPLE"
                                                            ? "Client adds as many as needed"
                                                            : `As many as "${countSource ?? "?"}" says`}
                                                        {param.maxEntries ? `, max ${param.maxEntries}` : ""}
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
                                            <TableCell>{param.type === "GROUP" ? "—" : describeAttachments(param)}</TableCell>
                                            <TableCell>{param.usageCount}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
