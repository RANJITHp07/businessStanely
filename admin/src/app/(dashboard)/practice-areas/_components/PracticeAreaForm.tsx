"use client"

import type React from "react"
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "react-toastify"
import { ArrowDown, ArrowUp, Briefcase, Edit, Plus, SlidersHorizontal, Trash2 } from "lucide-react"
import { fetchWithAuth } from "@/lib/fetchWithAuth"
import {
    effectiveAttachmentMode,
    MAX_AREA_DESCRIPTION_LENGTH,
    MAX_AREA_TITLE_LENGTH,
    MAX_ATTACHMENTS_LIMIT,
    MAX_PARAMETERS_PER_AREA,
    parameterTypeLabel,
    PRACTICE_AREA_ICONS,
    type DefinitionInput,
} from "@/lib/practiceAreaParameters"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import ParameterDialog from "./ParameterDialog"
import PracticeAreaIcon from "./PracticeAreaIcon"

/** A parameter while the form is open. Nothing is saved until the practice
    area is. `id` is null for one added in this form. */
export interface ParameterDraft extends DefinitionInput {
    key: string
    id: string | null
    usageCount: number
}

export interface PracticeAreaFormValues {
    title: string
    description: string
    icon: string
    active: boolean
    parameters: ParameterDraft[]
}

export const EMPTY_PRACTICE_AREA: PracticeAreaFormValues = {
    title: "",
    description: "",
    icon: "building",
    active: true,
    parameters: [],
}

function describeAttachments(param: DefinitionInput) {
    const mode = effectiveAttachmentMode(param)
    if (mode === "DISABLED") return "Disabled"
    return `${mode === "REQUIRED" ? "Required" : "Optional"} · max ${param.maxAttachments ?? MAX_ATTACHMENTS_LIMIT}`
}

/** Shared by the create and edit pages. `id` present means edit. */
export default function PracticeAreaForm({
    id,
    initial,
}: {
    id?: string
    initial: PracticeAreaFormValues
}) {
    const router = useRouter()
    const [formData, setFormData] = useState<PracticeAreaFormValues>(initial)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editing, setEditing] = useState<ParameterDraft | null>(null)
    const nextKey = useRef(0)

    const parameters = formData.parameters
    const setParameters = (update: (prev: ParameterDraft[]) => ParameterDraft[]) =>
        setFormData((prev) => ({ ...prev, parameters: update(prev.parameters) }))

    const openAdd = () => {
        if (parameters.length >= MAX_PARAMETERS_PER_AREA) {
            toast.error(`A parameter area can have at most ${MAX_PARAMETERS_PER_AREA} parameters`)
            return
        }
        setEditing(null)
        setDialogOpen(true)
    }

    const openEdit = (draft: ParameterDraft) => {
        setEditing(draft)
        setDialogOpen(true)
    }

    const handleDialogSave = (definition: DefinitionInput) => {
        const titleKey = definition.title.toLowerCase()
        const clash = parameters.some(
            (p) => p.key !== editing?.key && p.title.toLowerCase() === titleKey,
        )
        if (clash) {
            toast.error(`There is already a parameter called "${definition.title}"`)
            return
        }

        if (editing) {
            setParameters((prev) =>
                prev.map((p) => (p.key === editing.key ? { ...p, ...definition } : p)),
            )
        } else {
            nextKey.current += 1
            setParameters((prev) => [
                ...prev,
                { ...definition, key: `new-${nextKey.current}`, id: null, usageCount: 0 },
            ])
        }
        setDialogOpen(false)
    }

    const move = (index: number, direction: -1 | 1) =>
        setParameters((prev) => {
            const target = index + direction
            if (target < 0 || target >= prev.length) return prev
            const next = [...prev]
            ;[next[index], next[target]] = [next[target], next[index]]
            return next
        })

    const remove = (draft: ParameterDraft) =>
        setParameters((prev) => prev.filter((p) => p.key !== draft.key))

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.title.trim()) {
            toast.error("Practice area title is required")
            return
        }

        setIsSubmitting(true)
        try {
            const response = await fetchWithAuth(id ? `/api/practice-areas/${id}` : "/api/practice-areas", {
                method: id ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: formData.title,
                    description: formData.description,
                    icon: formData.icon,
                    active: formData.active,
                    // The full list, in order: the API adds, updates and removes
                    // parameters to match it.
                    parameters: parameters.map(({ key: _key, usageCount: _usage, ...rest }) => rest),
                }),
            })
            const data = await response.json().catch(() => ({}))
            if (!response.ok) {
                toast.error(data.error || "Something went wrong")
                return
            }
            toast.success(id ? "Practice area updated" : "Practice area created")
            router.push(`/practice-areas/${id ?? data.id}`)
        } catch {
            toast.error("An unexpected error occurred")
        } finally {
            setIsSubmitting(false)
        }
    }

    const removedWithAnswers = initial.parameters.filter(
        (p) => p.usageCount > 0 && !parameters.some((q) => q.key === p.key),
    )

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Briefcase className="h-5 w-5" />
                        Parameter Area Information
                    </CardTitle>
                    <CardDescription>How this service appears on the website</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Title *</Label>
                        <Input
                            id="title"
                            value={formData.title}
                            onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                            placeholder="e.g., Company & LLP incorporation"
                            maxLength={MAX_AREA_TITLE_LENGTH}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                            placeholder="One or two lines shown under the title on the website"
                            maxLength={MAX_AREA_DESCRIPTION_LENGTH}
                            rows={3}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="icon">Icon</Label>
                        <Select value={formData.icon} onValueChange={(icon) => setFormData((prev) => ({ ...prev, icon }))}>
                            <SelectTrigger id="icon" className="w-full md:w-72">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {PRACTICE_AREA_ICONS.map((icon) => (
                                    <SelectItem key={icon.value} value={icon.value}>
                                        <span className="flex items-center gap-2">
                                            <PracticeAreaIcon icon={icon.value} />
                                            {icon.label}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-start gap-2 pt-2">
                        <Checkbox
                            id="active"
                            checked={formData.active}
                            onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, active: checked === true }))}
                        />
                        <div className="space-y-1">
                            <Label htmlFor="active" className="cursor-pointer">
                                Show on website
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                Hidden parameter areas keep their parameters but visitors cannot pick them.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <SlidersHorizontal className="h-5 w-5" />
                                Parameters ({parameters.length})
                            </CardTitle>
                            <CardDescription className="mt-1.5">
                                After sending a request, the client fills these in, in this order, on the request in their portal
                            </CardDescription>
                        </div>
                        <Button
                            type="button"
                            onClick={openAdd}
                            className="bg-[#003459] hover:bg-[#003459] text-white rounded-lg px-4 py-2 flex items-center gap-2 cursor-pointer shadow-none hover:shadow-md transition-shadow duration-300"
                        >
                            <Plus className="h-4 w-4" />
                            Add Parameter
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12">#</TableHead>
                                    <TableHead>Title</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Required</TableHead>
                                    <TableHead>Attachments</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {parameters.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                            No parameters yet. Clients will not be asked for anything extra for this
                                            parameter area.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    parameters.map((param, index) => (
                                        <TableRow key={param.key}>
                                            <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                                            <TableCell className="font-medium">
                                                {param.title}
                                                {!param.id && id && (
                                                    <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0">
                                                        New
                                                    </Badge>
                                                )}
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
                                            </TableCell>
                                            <TableCell>
                                                {param.required ? (
                                                    <Badge className="bg-red-100 text-red-800 border-red-200 border">Required</Badge>
                                                ) : (
                                                    <Badge variant="secondary">Optional</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>{describeAttachments(param)}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        className="h-8 w-8 p-0"
                                                        disabled={index === 0}
                                                        onClick={() => move(index, -1)}
                                                        aria-label="Move up"
                                                    >
                                                        <ArrowUp className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        className="h-8 w-8 p-0"
                                                        disabled={index === parameters.length - 1}
                                                        onClick={() => move(index, 1)}
                                                        aria-label="Move down"
                                                    >
                                                        <ArrowDown className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        className="h-8 w-8 p-0"
                                                        onClick={() => openEdit(param)}
                                                        aria-label={`Edit ${param.title}`}
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                                        onClick={() => remove(param)}
                                                        aria-label={`Remove ${param.title}`}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    {removedWithAnswers.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                            Removing {removedWithAnswers.map((p) => `"${p.title}"`).join(", ")} keeps the answers
                            already saved on enquiries.
                        </p>
                    )}
                </CardContent>
            </Card>

            <div className="flex justify-end gap-4">
                <Button
                    onClick={() => router.push(id ? `/practice-areas/${id}` : "/practice-areas")}
                    className="bg-[#f42b03] hover:bg-[#f42b03] shadow-none hover:shadow-lg transition-shadow duration-300 text-white hover:text-white cursor-pointer"
                    type="button"
                    variant="outline"
                    disabled={isSubmitting}
                >
                    Cancel
                </Button>
                <Button
                    disabled={isSubmitting}
                    className="cursor-pointer shadow-none hover:shadow-lg transition-shadow duration-300"
                    type="submit"
                >
                    {isSubmitting ? (id ? "Saving..." : "Creating...") : id ? "Save Changes" : "Create Parameter Area"}
                </Button>
            </div>

            <ParameterDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                initial={editing}
                usageCount={editing?.usageCount ?? 0}
                areaTitle={formData.title.trim() || undefined}
                onSave={handleDialogSave}
            />
        </form>
    )
}
