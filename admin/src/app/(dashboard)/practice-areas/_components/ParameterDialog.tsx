"use client"

import { useEffect, useState } from "react"
import { toast } from "react-toastify"
import { Loader2 } from "lucide-react"
import {
    ATTACHMENT_MODES,
    FILE_TYPE_GROUPS,
    MAX_HELP_TEXT_LENGTH,
    MAX_ATTACHMENTS_LIMIT,
    MAX_ENTRIES_LIMIT,
    PARAMETER_TYPES,
    REPEAT_MODES,
    parseDefinitionInput,
    type DefinitionInput,
} from "@/lib/practiceAreaParameters"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

/** Picker value for "add a new parent parameter". */
export const NEW_PARENT = "__new__"

/** A parameter a sub-parameter can be grouped with. */
export interface GroupParentOption {
    key: string
    label: string
    type: string
    /** How the group is filled in now (NONE, FIXED, MULTIPLE, COUNT), null if it has no group yet. */
    times: string | null
    count: number | null
}

/** What the sub-parameter dialog sends back about its group. */
export interface GroupChoice {
    parent: string
}

interface FormState {
    title: string
    type: string
    required: boolean
    optionsText: string
    attachmentMode: string
    maxAttachments: string
    repeat: string
    maxEntries: string
    helpText: string
    fileTypes: string[]
    groupParent: string
    countRef: string
}

const EMPTY_FORM: FormState = {
    title: "",
    type: "TEXT",
    required: false,
    optionsText: "",
    attachmentMode: "DISABLED",
    maxAttachments: "1",
    repeat: "NONE",
    maxEntries: "",
    helpText: "",
    fileTypes: [],
    groupParent: NEW_PARENT,
    countRef: "",
}

function toFormState(initial: DefinitionInput | null): FormState {
    if (!initial) return EMPTY_FORM
    return {
        groupParent: NEW_PARENT,
        countRef: initial.countRef ?? "",
        title: initial.title,
        type: initial.type,
        required: initial.required,
        optionsText: initial.options.join("\n"),
        attachmentMode: initial.type === "FILE" ? "OPTIONAL" : initial.attachmentMode,
        maxAttachments: String(initial.maxAttachments ?? 1),
        repeat: initial.repeat,
        maxEntries: initial.maxEntries ? String(initial.maxEntries) : "",
        helpText: initial.helpText ?? "",
        fileTypes: [...initial.fileTypes],
    }
}

/**
 * Add / edit one parameter. Validates with the same rules the API uses and
 * hands back a clean definition; what happens to it (saved straight away, or
 * kept in a form until the practice area is saved) is up to the caller.
 */
export default function ParameterDialog({
    open,
    onOpenChange,
    initial,
    usageCount = 0,
    areaTitle,
    depth = 1,
    heading,
    groupWith,
    presetGroup = false,
    countSources = [],
    saving = false,
    onSave,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** The parameter being edited, or null to add a new one. */
    initial: DefinitionInput | null
    /** Dialog heading, when it is not the default for adding or editing. */
    heading?: string
    /** Adding a sub-parameter: where it is grouped and how often it is filled in. */
    groupWith?: { parents: GroupParentOption[]; initialParent: string }
    /** Adding a new Title (the heading a sub-parameter is grouped under): the type is fixed. */
    presetGroup?: boolean
    /** Single Number parameters a Title can take its repeat count from. */
    countSources?: { key: string; title: string }[]
    /** Enquiries that already answered it; any answer locks the type. */
    usageCount?: number
    areaTitle?: string
    /** 1 for a top-level parameter, 2 for a sub-parameter, and so on. */
    depth?: number
    saving?: boolean
    onSave: (
        definition: DefinitionInput,
        extra: { addAnother: boolean; group: GroupChoice | null },
    ) => void | Promise<void>
}) {
    const [form, setForm] = useState<FormState>(EMPTY_FORM)

    // Load the parameter each time the dialog opens, and only then: re-running
    // on every new `initial` object would wipe what is being typed whenever
    // the parent re-renders.
    useEffect(() => {
        if (open) {
            const base = toFormState(initial)
            if (groupWith) setForm({ ...base, groupParent: groupWith.initialParent })
            else if (presetGroup) setForm({ ...base, type: "GROUP" })
            else setForm(base)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    const isEditing = initial !== null
    const isFileType = form.type === "FILE"
    const isGroup = form.type === "GROUP"
    const showMaxAttachments = !isGroup && (isFileType || form.attachmentMode !== "DISABLED")
    const typeLocked = isEditing && usageCount > 0
    // Answers are stored per entry, so once any exist a parameter cannot go
    // from answered-once to repeating or back.
    const repeatLocked = isEditing && usageCount > 0
    const repeatChoices = REPEAT_MODES.filter(
        (m) =>
            (m.value !== "COUNT" || initial?.repeat === "COUNT" || countSources.length > 0) &&
            !(repeatLocked && initial?.repeat !== "NONE" && m.value === "NONE"),
    )

    const handleSave = (addAnother = false) => {
        const parsed = parseDefinitionInput({
            title: form.title,
            type: form.type,
            required: form.required,
            options: form.type === "SELECT" ? form.optionsText.split("\n") : [],
            attachmentMode: isFileType ? "OPTIONAL" : form.attachmentMode,
            maxAttachments: showMaxAttachments && !isGroup ? Number(form.maxAttachments) : null,
            helpText: form.helpText,
            fileTypes: showMaxAttachments ? form.fileTypes : [],
            repeat: isGroup ? form.repeat : "NONE",
            maxEntries: !isGroup || form.repeat === "NONE" ? null : form.maxEntries,
            countRef: isGroup && form.repeat === "COUNT" ? form.countRef : null,
        })
        if (!parsed.ok) {
            toast.error(parsed.error)
            return
        }
        void onSave(parsed.data, {
            addAnother,
            group: groupWith ? { parent: form.groupParent } : null,
        })
    }

    return (
        <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
            <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {heading ?? (isEditing
                            ? depth > 1 ? "Edit Sub-parameter" : "Edit Parameter"
                            : depth > 1 ? "Add Sub-parameter" : "Add Parameter")}
                    </DialogTitle>
                    <DialogDescription>
                        {areaTitle
                            ? `For the parameter area "${areaTitle}"`
                            : "A field clients fill in for this parameter area"}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">

                    {groupWith && (
                        <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                            <Label htmlFor="group-parent">Group with</Label>
                            <Select
                                value={form.groupParent}
                                onValueChange={(groupParent) => setForm((prev) => ({ ...prev, groupParent }))}
                            >
                                <SelectTrigger id="group-parent" className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {groupWith.parents.map((o) => (
                                        <SelectItem key={o.key} value={o.key}>
                                            {o.label}
                                        </SelectItem>
                                    ))}
                                    <SelectItem value={NEW_PARENT}>+ Add a new Title…</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                {form.groupParent === NEW_PARENT
                                    ? "After this you will be asked for the new Title and how many times its group is filled in."
                                    : "A Title is a heading that holds sub-parameters. How many times its group is filled in is set on the Title."}
                            </p>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="parameter-title">{isGroup ? "Title *" : "Parameter Title *"}</Label>
                        <Input
                            id="parameter-title"
                            value={form.title}
                            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                            placeholder="e.g., Company Name, Filing Date, Claim Amount"
                            maxLength={100}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="parameter-help">Instructions for the client</Label>
                        <Textarea
                            id="parameter-help"
                            value={form.helpText}
                            onChange={(e) => setForm((prev) => ({ ...prev, helpText: e.target.value }))}
                            rows={2}
                            maxLength={MAX_HELP_TEXT_LENGTH}
                            placeholder="e.g., Upload a clear scan of the PAN card (PDF or photo)"
                        />
                        <p className="text-xs text-muted-foreground">
                            Shown under the field. Use it to say exactly which document or detail you need.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="parameter-type">Parameter Type *</Label>
                        <Select
                            value={form.type}
                            onValueChange={(type) => setForm((prev) => ({ ...prev, type }))}
                            disabled={typeLocked || presetGroup}
                        >
                            <SelectTrigger id="parameter-type" className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {PARAMETER_TYPES.filter((t) => t.value !== "GROUP" || (!groupWith && depth === 1)).map((t) => (
                                    <SelectItem key={t.value} value={t.value}>
                                        {t.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {typeLocked && (
                            <p className="text-xs text-muted-foreground">
                                The type is locked because {usageCount} enquir{usageCount === 1 ? "y has" : "ies have"}{" "}
                                already answered it. Add a new parameter if you need a different type.
                            </p>
                        )}
                    </div>

                    {form.type === "SELECT" && (
                        <div className="space-y-2">
                            <Label htmlFor="parameter-options">Dropdown Options * (one per line)</Label>
                            <Textarea
                                id="parameter-options"
                                value={form.optionsText}
                                onChange={(e) => setForm((prev) => ({ ...prev, optionsText: e.target.value }))}
                                rows={5}
                                placeholder={"Option 1\nOption 2\nOption 3"}
                            />
                            {isEditing && (
                                <p className="text-xs text-muted-foreground">
                                    Removing an option does not change enquiries that already chose it.
                                </p>
                            )}
                        </div>
                    )}

                    {!isGroup && (
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="parameter-required"
                            checked={form.required}
                            onCheckedChange={(checked) => setForm((prev) => ({ ...prev, required: checked === true }))}
                        />
                        <Label htmlFor="parameter-required" className="cursor-pointer">
                            {isFileType
                                ? "Required (at least one file)"
                                : isGroup
                                  ? "Required (at least one entry must be filled in)"
                                  : "Required field"}
                        </Label>
                    </div>
                    )}

                    {isGroup && !groupWith && (
                    <div className="space-y-2">
                        <Label htmlFor="parameter-repeat">How many times must this group be filled in?</Label>
                        <Select
                            value={form.repeat}
                            onValueChange={(repeat) => setForm((prev) => ({ ...prev, repeat }))}
                            disabled={repeatLocked && initial?.repeat === "NONE"}
                        >
                            <SelectTrigger id="parameter-repeat" className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {repeatChoices.map((m) => (
                                    <SelectItem key={m.value} value={m.value}>
                                        {m.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {repeatLocked && (
                            <p className="text-xs text-muted-foreground">
                                {initial?.repeat === "NONE"
                                    ? "This cannot become repeating because enquiries already hold answers to it."
                                    : "This cannot go back to answered-once because enquiries already hold answers to it."}
                            </p>
                        )}
                        {form.repeat === "MULTIPLE" && (
                            <p className="text-xs text-muted-foreground">
                                The client gets an &quot;Add another&quot; button and can add as many entries as they need.
                            </p>
                        )}
                    </div>
                    )}

                    {isGroup && form.repeat === "COUNT" && (
                        <div className="space-y-2">
                            <Label htmlFor="parameter-count">Number parameter *</Label>
                            <Select
                                value={form.countRef}
                                onValueChange={(countRef) => setForm((prev) => ({ ...prev, countRef }))}
                            >
                                <SelectTrigger id="parameter-count" className="w-full">
                                    <SelectValue placeholder="Choose a Number parameter" />
                                </SelectTrigger>
                                <SelectContent>
                                    {countSources.map((c) => (
                                        <SelectItem key={c.key} value={c.key}>
                                            {c.title}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                e.g. &quot;How many directors are there?&quot; = 4 shows the group 4 times.
                            </p>
                        </div>
                    )}

                    {isGroup && !groupWith && (form.repeat === "FIXED" || form.repeat === "MULTIPLE") && (
                        <div className="space-y-2">
                            <Label htmlFor="parameter-max-entries">
                                {form.repeat === "FIXED" ? "Number of times *" : "Maximum entries"}
                            </Label>
                            <Input
                                id="parameter-max-entries"
                                type="number"
                                min={1}
                                max={MAX_ENTRIES_LIMIT}
                                value={form.maxEntries}
                                onChange={(e) => setForm((prev) => ({ ...prev, maxEntries: e.target.value }))}
                                placeholder={form.repeat === "FIXED" ? "e.g., 2" : `Leave empty for up to ${MAX_ENTRIES_LIMIT}`}
                            />
                        </div>
                    )}

                    {isGroup ? null : isFileType ? (
                        <p className="text-xs text-muted-foreground">
                            An attachments-only parameter always accepts files and has no text input.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            <Label htmlFor="parameter-attachments">Attachments</Label>
                            <Select
                                value={form.attachmentMode}
                                onValueChange={(attachmentMode) => setForm((prev) => ({ ...prev, attachmentMode }))}
                            >
                                <SelectTrigger id="parameter-attachments" className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {ATTACHMENT_MODES.map((m) => (
                                        <SelectItem key={m.value} value={m.value}>
                                            {m.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {showMaxAttachments && (
                        <div className="space-y-2">
                            <Label htmlFor="parameter-max">Maximum Files *</Label>
                            <Input
                                id="parameter-max"
                                type="number"
                                min={1}
                                max={MAX_ATTACHMENTS_LIMIT}
                                value={form.maxAttachments}
                                onChange={(e) => setForm((prev) => ({ ...prev, maxAttachments: e.target.value }))}
                            />
                            <p className="text-xs text-muted-foreground">
                                Up to {MAX_ATTACHMENTS_LIMIT} files, 25 MB each.
                            </p>
                        </div>
                    )}

                    {showMaxAttachments && (
                        <div className="space-y-2">
                            <Label>Accepted document types</Label>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {FILE_TYPE_GROUPS.map((t) => (
                                    <div key={t.value} className="flex items-center gap-2">
                                        <Checkbox
                                            id={`file-type-${t.value}`}
                                            checked={form.fileTypes.includes(t.value)}
                                            onCheckedChange={(checked) =>
                                                setForm((prev) => ({
                                                    ...prev,
                                                    fileTypes:
                                                        checked === true
                                                            ? [...prev.fileTypes, t.value]
                                                            : prev.fileTypes.filter((v) => v !== t.value),
                                                }))
                                            }
                                        />
                                        <Label htmlFor={`file-type-${t.value}`} className="cursor-pointer text-sm font-normal">
                                            {t.label}
                                        </Label>
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Tick none to accept any supported type (PDF, images, Word, Excel, text).
                            </p>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                        Cancel
                    </Button>
                    {!isEditing && (
                        <Button type="button" variant="outline" onClick={() => handleSave(true)} disabled={saving}>
                            Save &amp; add another
                        </Button>
                    )}
                    <Button type="button" onClick={() => handleSave()} disabled={saving}>
                        {saving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : isEditing ? (
                            "Save Changes"
                        ) : (
                            "Add Parameter"
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
