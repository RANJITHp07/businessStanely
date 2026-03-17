"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Bold,
    Italic,
    Underline,
    List,
    ListOrdered,
    Heading1,
    Heading2,
    Plus,
    Save,
    Trash2,
} from "lucide-react";
import { toast } from "react-toastify";

type DiaryNote = {
    id: string;
    title: string;
    content: string;
    createdAt: string;
    updatedAt: string;
};

const getPlainText = (html: string) => {
    return html
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
};

export default function DiaryPage() {
    const [notes, setNotes] = useState<DiaryNote[]>([]);
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const [draftTitle, setDraftTitle] = useState("");
    const [draftHtml, setDraftHtml] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [activeFormats, setActiveFormats] = useState({
        bold: false,
        italic: false,
        underline: false,
        unorderedList: false,
        orderedList: false,
        h1: false,
        h2: false,
    });

    const editorRef = useRef<HTMLDivElement>(null);

    const syncDraftToEditor = (html: string) => {
        if (editorRef.current) {
            editorRef.current.innerHTML = html;
        }
    };

    const resetActiveFormats = () => {
        setActiveFormats({
            bold: false,
            italic: false,
            underline: false,
            unorderedList: false,
            orderedList: false,
            h1: false,
            h2: false,
        });
    };

    const updateActiveFormats = () => {
        if (!editorRef.current) return;

        const selection = document.getSelection();
        if (!selection || selection.rangeCount === 0) {
            resetActiveFormats();
            return;
        }

        const anchorNode = selection.anchorNode;
        if (!anchorNode || !editorRef.current.contains(anchorNode)) {
            resetActiveFormats();
            return;
        }

        const formatBlockValue = String(document.queryCommandValue("formatBlock") || "")
            .replace(/[<>]/g, "")
            .toLowerCase();

        setActiveFormats({
            bold: document.queryCommandState("bold"),
            italic: document.queryCommandState("italic"),
            underline: document.queryCommandState("underline"),
            unorderedList: document.queryCommandState("insertUnorderedList"),
            orderedList: document.queryCommandState("insertOrderedList"),
            h1: formatBlockValue === "h1",
            h2: formatBlockValue === "h2",
        });
    };

    const toolbarButtonClass = (isActive: boolean) =>
        isActive ? "bg-primary text-primary-foreground hover:bg-primary/90" : "";

    const fetchNotes = async () => {
        try {
            setIsLoading(true);
            const response = await fetch("/api/my-diary", {
                method: "GET",
            });

            if (!response.ok) {
                if (response.status === 401) {
                    toast.error("Please login again");
                    return;
                }
                throw new Error("Failed to load diary notes");
            }

            const data = await response.json();
            const fetchedNotes: DiaryNote[] = Array.isArray(data.entries)
                ? data.entries
                : [];

            setNotes(fetchedNotes);

            if (fetchedNotes.length > 0) {
                const firstNote = fetchedNotes[0];
                setSelectedNoteId(firstNote.id);
                setDraftTitle(firstNote.title);
                setDraftHtml(firstNote.content);
                syncDraftToEditor(firstNote.content);
            } else {
                setSelectedNoteId(null);
                setDraftTitle("");
                setDraftHtml("");
                syncDraftToEditor("");
            }
        } catch (error) {
            console.error("Error loading diary notes:", error);
            toast.error("Failed to load diary notes");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchNotes();
    }, []);

    useEffect(() => {
        const handleSelectionChange = () => {
            updateActiveFormats();
        };

        document.addEventListener("selectionchange", handleSelectionChange);

        return () => {
            document.removeEventListener("selectionchange", handleSelectionChange);
        };
    }, []);

    const loadNote = (note: DiaryNote) => {
        setSelectedNoteId(note.id);
        setDraftTitle(note.title);
        setDraftHtml(note.content);
        syncDraftToEditor(note.content);
    };

    const newNote = () => {
        setSelectedNoteId(null);
        setDraftTitle("");
        setDraftHtml("");
        syncDraftToEditor("");
    };

    const runEditorCommand = (command: string, value?: string) => {
        if (!editorRef.current) return;

        editorRef.current.focus();

        document.execCommand(command, false, value);

        setDraftHtml(editorRef.current.innerHTML);
        updateActiveFormats();
    };

    const handleEditorInput = () => {
        if (!editorRef.current) return;

        setDraftHtml(editorRef.current.innerHTML);
        updateActiveFormats();
    };

    const handleSave = async () => {
        const text = getPlainText(draftHtml);

        if (!text) {
            toast.error("Write something");
            return;
        }

        const title = draftTitle.trim() || text.split(" ").slice(0, 6).join(" ");

        try {
            if (selectedNoteId) {
                const response = await fetch(`/api/my-diary/${selectedNoteId}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ title, content: draftHtml }),
                });

                if (!response.ok) {
                    throw new Error("Failed to update note");
                }

                const data = await response.json();
                const updatedEntry: DiaryNote = data.entry;

                setNotes((previous) => {
                    const merged = previous.map((item) =>
                        item.id === updatedEntry.id ? updatedEntry : item,
                    );
                    return merged.sort(
                        (a, b) =>
                            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
                    );
                });

                setDraftTitle(updatedEntry.title);
            } else {
                const response = await fetch("/api/my-diary", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ title, content: draftHtml }),
                });

                if (!response.ok) {
                    throw new Error("Failed to create note");
                }

                const data = await response.json();
                const createdEntry: DiaryNote = data.entry;

                setNotes((previous) => [createdEntry, ...previous]);
                setSelectedNoteId(createdEntry.id);
                setDraftTitle(createdEntry.title);
            }

            toast.success("Saved");
        } catch (error) {
            console.error("Error saving note:", error);
            toast.error("Failed to save note");
        }
    };

    const handleDelete = async () => {
        if (!selectedNoteId) return;

        try {
            const response = await fetch(`/api/my-diary/${selectedNoteId}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                throw new Error("Failed to delete note");
            }

            const remaining = notes.filter((note) => note.id !== selectedNoteId);
            setNotes(remaining);

            if (remaining.length > 0) {
                loadNote(remaining[0]);
            } else {
                newNote();
            }

            toast.success("Deleted");
        } catch (error) {
            console.error("Error deleting note:", error);
            toast.error("Failed to delete note");
        }
    };

    return (
        <div className="h-screen flex bg-white">
            <div className="w-[320px] border-r bg-muted/30 flex flex-col">
                <div className="p-4 border-b flex justify-between items-center">
                    <h2 className="font-semibold text-sm">Notes</h2>

                    <Button size="icon" variant="ghost" onClick={newNote}>
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>

                <div className="flex-1 overflow-auto">
                    {isLoading && (
                        <div className="p-4 text-sm text-muted-foreground">
                            Loading notes...
                        </div>
                    )}

                    {notes.map((note) => {
                        const preview = getPlainText(note.content);

                        return (
                            <div
                                key={note.id}
                                onClick={() => loadNote(note)}
                                className={`p-4 border-b cursor-pointer hover:bg-muted ${selectedNoteId === note.id ? "bg-muted" : ""
                                    }`}
                            >
                                <p className="font-medium text-sm line-clamp-1">{note.title}</p>

                                <p className="text-xs text-muted-foreground">
                                    {new Date(note.updatedAt).toLocaleDateString()}
                                </p>

                                <p className="text-xs mt-1 line-clamp-2 text-muted-foreground">
                                    {preview}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="flex-1 flex flex-col">
                <div className="border-b p-4 flex gap-2 flex-wrap">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => runEditorCommand("bold")}
                        className={toolbarButtonClass(activeFormats.bold)}
                    >
                        <Bold className="h-4 w-4" />
                    </Button>

                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => runEditorCommand("italic")}
                        className={toolbarButtonClass(activeFormats.italic)}
                    >
                        <Italic className="h-4 w-4" />
                    </Button>

                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => runEditorCommand("underline")}
                        className={toolbarButtonClass(activeFormats.underline)}
                    >
                        <Underline className="h-4 w-4" />
                    </Button>

                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => runEditorCommand("insertUnorderedList")}
                        className={toolbarButtonClass(activeFormats.unorderedList)}
                    >
                        <List className="h-4 w-4" />
                    </Button>

                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => runEditorCommand("insertOrderedList")}
                        className={toolbarButtonClass(activeFormats.orderedList)}
                    >
                        <ListOrdered className="h-4 w-4" />
                    </Button>

                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => runEditorCommand("formatBlock", "<h1>")}
                        className={toolbarButtonClass(activeFormats.h1)}
                    >
                        <Heading1 className="h-4 w-4" />
                    </Button>

                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => runEditorCommand("formatBlock", "<h2>")}
                        className={toolbarButtonClass(activeFormats.h2)}
                    >
                        <Heading2 className="h-4 w-4" />
                    </Button>

                    <Button size="sm" onClick={handleSave}>
                        <Save className="h-4 w-4 mr-2" />
                        Save
                    </Button>

                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleDelete}
                        disabled={!selectedNoteId}
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                    </Button>
                </div>

                <div className="p-4 border-b">
                    <Input
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        placeholder="Note title"
                    />
                </div>

                <div className="flex-1 overflow-auto relative">
                    <div
                        ref={editorRef}
                        contentEditable
                        suppressContentEditableWarning
                        onInput={handleEditorInput}
                        className="p-6 min-h-full outline-none text-sm leading-7"
                    />

                    {!getPlainText(draftHtml) && (
                        <p className="absolute top-6 left-6 text-sm text-muted-foreground pointer-events-none">
                            Write your diary here...
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
