"use client"

import { useEffect, useState } from "react"
import { toast } from "react-toastify"
import { Loader2 } from "lucide-react"
import {
    ATTACHMENT_MODES,
    MAX_ATTACHMENTS_LIMIT,
    PARAMETER_TYPES,
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

interface FormState {
    title: string
    type: string
    required: boolean
    optionsText: string
    attachmentMode: string
    maxAttachments: string
}

const EMPTY_FORM: FormState = {
    title: "",
    type: "TEXT",
    required: false,
    optionsText: "",
    attachmentMode: "DISABLED",
    maxAttachments: "1",
}

function toFormState(initial: DefinitionInput | null): FormState {
    if (!initial) return EMPTY_FORM
    return {
        title: initial.title,
        type: initial.type,
        required: initial.required,
        optionsText: initial.options.join("\n"),
        attachmentMode: initial.type === "FILE" ? "OPTIONAL" : initial.attachmentMode,
        maxAttachments: String(initial.maxAttachments ?? 1),
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
    saving = false,
    onSave,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** The parameter being edited, or null to add a new one. */
    initial: DefinitionInput | null
    /** Enquiries that already answered it; any answer locks the type. */
    usageCount?: number
    areaTitle?: string
    saving?: boolean
    onSave: (definition: DefinitionInput) => void | Promise<void>
}) {
    const [form, setForm] = useState<FormState>(EMPTY_FORM)

    // Load the parameter each time the dialog opens, and only then: re-running
    // on every new `initial` object would wipe what is being typed whenever
    // the parent re-renders.
    useEffect(() => {
        if (open) {
            setForm(toFormState(initial))
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    const isEditing = initial !== null
    const isFileType = form.type === "FILE"
    const showMaxAttachments = isFileType || form.attachmentMode !== "DISABLED"
    const typeLocked = isEditing && usageCount > 0

    const handleSave = () => {
        const parsed = parseDefinitionInput({
            title: form.title,
            type: form.type,
            required: form.required,
            options: form.type === "SELECT" ? form.optionsText.split("\n") : [],
            attachmentMode: isFileType ? "OPTIONAL" : form.attachmentMode,
            maxAttachments: showMaxAttachments ? Number(form.maxAttachments) : null,
        })
        if (!parsed.ok) {
            toast.error(parsed.error)
            return
        }
        void onSave(parsed.data)
    }

    return (
        <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
            <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isEditing ? "Edit Parameter" : "Add Parameter"}</DialogTitle>
                    <DialogDescription>
                        {areaTitle
                            ? `For the parameter area "${areaTitle}"`
                            : "A field clients fill in for this parameter area"}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">

                    <div className="space-y-2">
                        <Label htmlFor="parameter-title">Parameter Title *</Label>
                        <Input
                            id="parameter-title"
                            value={form.title}
                            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                            placeholder="e.g., Company Name, Filing Date, Claim Amount"
                            maxLength={100}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="parameter-type">Parameter Type *</Label>
                        <Select
                            value={form.type}
                            onValueChange={(type) => setForm((prev) => ({ ...prev, type }))}
                            disabled={typeLocked}
                        >
                            <SelectTrigger id="parameter-type" className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {PARAMETER_TYPES.map((t) => (
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

                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="parameter-required"
                            checked={form.required}
                            onCheckedChange={(checked) => setForm((prev) => ({ ...prev, required: checked === true }))}
                        />
                        <Label htmlFor="parameter-required" className="cursor-pointer">
                            {isFileType ? "Required (at least one file)" : "Required field"}
                        </Label>
                    </div>

                    {isFileType ? (
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
                                Up to {MAX_ATTACHMENTS_LIMIT} files, 25 MB each. PDF, images, Word, Excel and text files.
                            </p>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                        Cancel
                    </Button>
                    <Button type="button" onClick={handleSave} disabled={saving}>
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
