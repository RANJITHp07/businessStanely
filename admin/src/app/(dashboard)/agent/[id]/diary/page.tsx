"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Plus } from "lucide-react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

type AgentDiaryEntry = {
    id: string;
    title: string;
    content: string;
    createdAt: string;
    updatedAt: string;
};

type AgentProfile = {
    id: string;
    name: string;
    email: string;
};

const getPlainText = (html: string) =>
    html
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();

export default function AgentDiaryViewerPage() {
    const params = useParams();
    const agentId = params.id as string;

    const [agent, setAgent] = useState<AgentProfile | null>(null);
    const [entries, setEntries] = useState<AgentDiaryEntry[]>([]);
    const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const selectedEntry = useMemo(
        () => entries.find((entry) => entry.id === selectedEntryId) || null,
        [entries, selectedEntryId],
    );

    useEffect(() => {
        if (!agentId) return;

        const fetchData = async () => {
            try {
                setIsLoading(true);

                const [agentResponse, diaryResponse] = await Promise.all([
                    fetchWithAuth(`/api/agents/${agentId}`),
                    fetchWithAuth(`/api/agents/${agentId}/diary`),
                ]);

                if (agentResponse.ok) {
                    const agentData = await agentResponse.json();
                    setAgent({
                        id: agentData.id,
                        name: agentData.name,
                        email: agentData.email,
                    });
                }

                if (diaryResponse.ok) {
                    const diaryData = await diaryResponse.json();
                    const fetchedEntries: AgentDiaryEntry[] = Array.isArray(diaryData.entries)
                        ? diaryData.entries
                        : [];
                    setEntries(fetchedEntries);
                    setSelectedEntryId(fetchedEntries[0]?.id || null);
                } else {
                    setEntries([]);
                    setSelectedEntryId(null);
                }
            } catch (error) {
                console.error("Error loading agent diary:", error);
                setEntries([]);
                setSelectedEntryId(null);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [agentId]);

    return (
        <div className="h-screen flex bg-white">
            <div className="w-85 border-r bg-muted/30 flex flex-col">
                <div className="p-4 border-b">
                    <h2 className="font-semibold text-sm flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Agent Diary
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                        {agent?.name || "Agent"}
                        {agent?.email ? ` (${agent.email})` : ""}
                    </p>
                </div>

                <div className="flex-1 overflow-auto">
                    {isLoading && (
                        <div className="p-4 text-sm text-muted-foreground">Loading diary entries...</div>
                    )}

                    {!isLoading && entries.length === 0 && (
                        <div className="p-4 text-sm text-muted-foreground">
                            No diary entries found for this agent.
                        </div>
                    )}

                    {entries.map((entry) => (
                        <div
                            key={entry.id}
                            onClick={() => setSelectedEntryId(entry.id)}
                            className={`p-4 border-b cursor-pointer hover:bg-muted ${selectedEntryId === entry.id ? "bg-muted" : ""}`}
                        >
                            <p className="font-medium text-sm truncate">{entry.title || "Untitled"}</p>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {getPlainText(entry.content)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                                Updated: {new Date(entry.updatedAt).toLocaleString()}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex-1 p-4 md:p-6 overflow-auto">
                {!selectedEntry && !isLoading && (
                    <Card>
                        <CardContent className="py-14 text-center text-muted-foreground">
                            <div className="flex items-center justify-center gap-2 text-sm">
                                <Plus className="h-4 w-4" />
                                Select a diary entry from the left panel.
                            </div>
                        </CardContent>
                    </Card>
                )}

                {selectedEntry && (
                    <Card>
                        <CardHeader>
                            <CardTitle>{selectedEntry.title || "Untitled"}</CardTitle>
                            <div className="text-xs text-muted-foreground">
                                Created: {new Date(selectedEntry.createdAt).toLocaleString()} | Updated: {new Date(selectedEntry.updatedAt).toLocaleString()}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div
                                className="prose prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ __html: selectedEntry.content || "" }}
                            />
                            {!getPlainText(selectedEntry.content || "") && (
                                <p className="text-sm text-muted-foreground">No content in this entry.</p>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
