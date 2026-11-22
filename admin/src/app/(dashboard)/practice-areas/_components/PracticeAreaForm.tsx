"use client"

import type React from "react"
import { Fragment, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "react-toastify"
import { ArrowDown, ArrowUp, Briefcase, CornerDownRight, Edit, Plus, Repeat, SlidersHorizontal, Trash2 } from "lucide-react"
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
import ParameterDialog, { NEW_PARENT, type GroupParentOption } from "./ParameterDialog"
import PracticeAreaIcon from "./PracticeAreaIcon"

/** A parameter while the form is open. Nothing is saved until the practice
    area is. `id` is null for one added in this form. */
export interface ParameterDraft extends DefinitionInput {
    key: string
    id: string | null
    usageCount: number
    /** The sub-parameters of a Title (GROUP) parameter; empty otherwise. */
    children: ParameterDraft[]
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

function flatten(list: ParameterDraft[]): ParameterDraft[] {
    return list.flatMap((p) => [p, ...flatten(p.children)])
}

/** Applies `fn` to the list under `parentKey` (null = the top level). */
function editList(
    list: ParameterDraft[],
    parentKey: string | null,
    fn: (siblings: ParameterDraft[]) => ParameterDraft[],
): ParameterDraft[] {
    if (parentKey === null) return fn(list)
    return list.map((p) =>
        p.key === parentKey ? { ...p, children: fn(p.children) } : { ...p, children: editList(p.children, parentKey, fn) },
    )
}

function siblingsOf(list: ParameterDraft[], parentKey: string | null): ParameterDraft[] {
    if (parentKey === null) return list
    return flatten(list).find((p) => p.key === parentKey)?.children ?? []
}

/** The request body form of the tree: no UI-only fields. */
function serialize(list: ParameterDraft[]): unknown[] {
    return list.map(({ usageCount: _usage, children, ...rest }) => ({ ...rest, children: serialize(children) }))
}

function describeRepeat(param: ParameterDraft, siblings: ParameterDraft[]) {
    if (param.repeat === "NONE") return null
    const cap = param.maxEntries ? `, max ${param.maxEntries}` : ""
    if (param.repeat === "FIXED") return `Repeats: filled in ${param.maxEntries ?? "?"} times`
    if (param.repeat === "MULTIPLE") return `Repeats: client adds as many as needed${cap}`
    const source = siblings.find((s) => s.key === param.countRef)
    return `Repeats: as many as "${source?.title ?? "?"}" says${cap}`
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
    // Which parameter the dialog is for: `editing` null means adding, under
    // `parentKey` (null = top level). `depth` is 1 for a top-level parameter.
    const [dialog, setDialog] = useState<{
        parentKey: string | null
        depth: number
        editing: ParameterDraft | null
        /** Adding a sub-parameter: the dialog also asks which parameter it is grouped with. */
        sub?: { initialParent: string }
        /** Adding the new Title a sub-parameter was grouped under. */
        forParent?: boolean
    } | null>(null)
    // The sub-parameter waiting for its new parent parameter to be filled in.
    const [pendingChild, setPendingChild] = useState<ParameterDraft | null>(null)
    const nextKey = useRef(0)
    const [dialogKey, setDialogKey] = useState(0)

    const parameters = formData.parameters
    const totalCount = flatten(parameters).length
    const setParameters = (update: (prev: ParameterDraft[]) => ParameterDraft[]) =>
        setFormData((prev) => ({ ...prev, parameters: update(prev.parameters) }))

    const openAdd = (parentKey: string | null, depth: number) => {
        if (totalCount >= MAX_PARAMETERS_PER_AREA) {
            toast.error(`A parameter area can have at most ${MAX_PARAMETERS_PER_AREA} parameters, sub-parameters included`)
            return
        }
        setDialog({ parentKey, depth, editing: null })
    }

    const openEdit = (draft: ParameterDraft, parentKey: string | null, depth: number) =>
        setDialog({ parentKey, depth, editing: draft })

    /* The Titles a sub-parameter can be grouped under: top-level GROUP parameters. */
    const parentOptions: GroupParentOption[] = parameters
        .filter((p) => p.type === "GROUP")
        .map((p) => ({ key: p.key, label: p.title, type: p.type, times: p.repeat, count: p.repeat === "FIXED" ? p.maxEntries : null }))

    const openSub = (initialParent: string) => {
        if (totalCount >= MAX_PARAMETERS_PER_AREA) {
            toast.error(`A parameter area can have at most ${MAX_PARAMETERS_PER_AREA} parameters, sub-parameters included`)
            return
        }
        const known = parentOptions.some((o) => o.key === initialParent)
        setDialogKey((k) => k + 1)
        setDialog({
            parentKey: null,
            depth: 2,
            editing: null,
            sub: { initialParent: known ? initialParent : (parentOptions[0]?.key ?? NEW_PARENT) },
        })
    }

    /* Saving the details of a new sub-parameter, with the Title it joins. */
    const handleSubSave = (
        definition: DefinitionInput,
        extra: { addAnother: boolean; group: { parent: string } | null },
    ) => {
        const group = extra.group
        if (!group) return
        nextKey.current += 1
        const child: ParameterDraft = {
            ...definition,
            key: `new-${nextKey.current}`,
            id: null,
            usageCount: 0,
            children: [],
        }

        if (group.parent === NEW_PARENT) {
            // The new Title comes next: its name and how many times it is filled in.
            setPendingChild(child)
            setDialogKey((k) => k + 1)
            setDialog({ parentKey: null, depth: 1, editing: null, forParent: true })
            return
        }

        const parent = parameters.find((p) => p.key === group.parent)
        if (!parent) {
            toast.error("Choose which Title it is grouped with")
            return
        }
        if (parent.children.some((c) => c.title.toLowerCase() === child.title.toLowerCase())) {
            toast.error(`"${parent.title}" already has a sub-parameter called "${child.title}"`)
            return
        }
        setParameters((prev) =>
            prev.map((p) => (p.key === group.parent ? { ...p, children: [...p.children, child] } : p)),
        )
        if (extra.addAnother) {
            setDialogKey((k) => k + 1)
            setDialog({ parentKey: null, depth: 2, editing: null, sub: { initialParent: group.parent } })
            return
        }
        setDialog(null)
    }

    const handleDialogSave = (
        definition: DefinitionInput,
        extra: { addAnother: boolean; group: { parent: string } | null },
    ) => {
        if (!dialog) return
        if (dialog.sub) {
            handleSubSave(definition, extra)
            return
        }
        const { editing, parentKey } = dialog
        const others = siblingsOf(parameters, parentKey).filter((p) => p.key !== editing?.key)
        if (others.some((p) => p.title.toLowerCase() === definition.title.toLowerCase())) {
            toast.error(`There is already a parameter called "${definition.title}" here`)
            return
        }

        if (editing) {
            setParameters((prev) =>
                editList(prev, parentKey, (siblings) =>
                    siblings.map((p) =>
                        p.key === editing.key
                            ? { ...p, ...definition, children: definition.type === "GROUP" ? p.children : [] }
                            : p,
                    ),
                ),
            )
        } else {
            nextKey.current += 1
            const draft: ParameterDraft = {
                ...definition,
                key: `new-${nextKey.current}`,
                id: null,
                usageCount: 0,
                // The sub-parameter this new Title was being added for.
                children: dialog.forParent && pendingChild ? [pendingChild] : [],
            }
            if (dialog.forParent) setPendingChild(null)
            setParameters((prev) => editList(prev, parentKey, (siblings) => [...siblings, draft]))
            if (extra.addAnother && !dialog.forParent) {
                setDialogKey((k) => k + 1)
                setDialog({ ...dialog, editing: null })
                return
            }
        }
        setDialog(null)
    }

    const move = (parentKey: string | null, index: number, direction: -1 | 1) =>
        setParameters((prev) =>
            editList(prev, parentKey, (siblings) => {
                const target = index + direction
                if (target < 0 || target >= siblings.length) return siblings
                const next = [...siblings]
                ;[next[index], next[target]] = [next[target], next[index]]
                return next
            }),
        )

    const remove = (parentKey: string | null, draft: ParameterDraft) =>
        setParameters((prev) => editList(prev, parentKey, (siblings) => siblings.filter((p) => p.key !== draft.key)))

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
                    parameters: serialize(parameters),
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

    const currentKeys = new Set(flatten(parameters).map((p) => p.key))
    const removedWithAnswers = flatten(initial.parameters).filter(
        (p) => p.usageCount > 0 && p.type !== "GROUP" && !currentKeys.has(p.key),
    )

    const renderRows = (
        list: ParameterDraft[],
        parentKey: string | null,
        depth: number,
        numberPrefix: string,
    ): React.ReactNode =>
        list.map((param, index) => {
            const number = `${numberPrefix}${index + 1}`
            const repeatNote = describeRepeat(param, list)
            return (
                <Fragment key={param.key}>
                    <TableRow className={depth > 1 ? "bg-muted/30" : undefined}>
                        <TableCell className="text-muted-foreground">{number}</TableCell>
                        <TableCell className="font-medium">
                            <div className="flex items-center gap-1" style={{ paddingLeft: (depth - 1) * 20 }}>
                                {depth > 1 && <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                                <span>{param.title}</span>
                                {!param.id && id && (
                                    <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0">
                                        New
                                    </Badge>
                                )}
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
                            {repeatNote && (
                                <div className="mt-0.5 flex items-center gap-1 text-xs text-blue-700">
                                    <Repeat className="h-3 w-3 shrink-0" />
                                    {repeatNote}
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
                        <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="h-8 w-8 p-0"
                                    disabled={index === 0}
                                    onClick={() => move(parentKey, index, -1)}
                                    aria-label="Move up"
                                >
                                    <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="h-8 w-8 p-0"
                                    disabled={index === list.length - 1}
                                    onClick={() => move(parentKey, index, 1)}
                                    aria-label="Move down"
                                >
                                    <ArrowDown className="h-4 w-4" />
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="h-8 w-8 p-0"
                                    onClick={() => openEdit(param, parentKey, depth)}
                                    aria-label={`Edit ${param.title}`}
                                >
                                    <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                    onClick={() => remove(parentKey, param)}
                                    aria-label={`Remove ${param.title}`}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </TableCell>
                    </TableRow>
                    {param.type === "GROUP" && (
                        <>
                            {renderRows(param.children, param.key, depth + 1, `${number}.`)}
                            <TableRow className="bg-muted/30">
                                <TableCell />
                                <TableCell colSpan={5}>
                                    <div style={{ paddingLeft: depth * 20 }} className="flex items-center gap-3">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="h-8 px-3 text-xs"
                                            onClick={() => openSub(param.key)}
                                        >
                                            <Plus className="mr-1 h-3.5 w-3.5" />
                                            Add sub-parameter to &quot;{param.title}&quot;
                                        </Button>
                                        {param.children.length === 0 && (
                                            <span className="text-xs text-amber-700">
                                                A group needs at least one sub-parameter.
                                            </span>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        </>
                    )}
                </Fragment>
            )
        })

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
                                Parameters ({totalCount})
                            </CardTitle>
                            <CardDescription className="mt-1.5">
                                After sending a request, the client fills these in, in this order, on the request in their portal. A Group holds sub-parameters, and any parameter or group can repeat.
                            </CardDescription>
                        </div>
                        <Button
                            type="button"
                            onClick={() => openAdd(null, 1)}
                            className="bg-[#003459] hover:bg-[#003459] text-white rounded-lg px-4 py-2 flex items-center gap-2 cursor-pointer shadow-none hover:shadow-md transition-shadow duration-300"
                        >
                            <Plus className="h-4 w-4" />
                            Add Parameter
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => openSub(parentOptions[0]?.key ?? NEW_PARENT)}
                            className="rounded-lg px-4 py-2 flex items-center gap-2 cursor-pointer"
                        >
                            <Plus className="h-4 w-4" />
                            Add Sub-parameter
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
                                    renderRows(parameters, null, 1, "")
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
                key={dialogKey}
                open={dialog !== null}
                onOpenChange={(open) => {
                    if (open) return
                    setDialog(null)
                    setPendingChild(null)
                }}
                initial={dialog?.editing ?? null}
                heading={dialog?.forParent ? "Add Title" : dialog?.sub ? "Add Sub-parameter" : undefined}
                groupWith={dialog?.sub ? { parents: parentOptions, initialParent: dialog.sub.initialParent } : undefined}
                presetGroup={dialog?.forParent === true}
                countSources={parameters
                    .filter((p) => p.type === "NUMBER" && p.repeat === "NONE" && p.key !== dialog?.editing?.key)
                    .map((p) => ({ key: p.key, title: p.title }))}
                usageCount={dialog?.editing?.usageCount ?? 0}
                areaTitle={formData.title.trim() || undefined}
                depth={dialog?.depth ?? 1}
                onSave={handleDialogSave}
            />
        </form>
    )
}
