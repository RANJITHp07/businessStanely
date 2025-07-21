"use client"

import { useState, useEffect } from 'react';
import AgentForm from '@/app/agent/_component/agentForm';
import { notFound } from 'next/navigation';

import { Agent } from '@/types';

export default function EditAgentPage({ params: { id } }: { params: { id: string } }) {
    const [agent, setAgent] = useState<Agent | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAgent = async () => {
            try {
                const response = await fetch(`/api/agents/${id}`);
                if (response.ok) {
                    const data = await response.json();
                    setAgent(data);
                } else {
                    notFound();
                }
            } catch (error) {
                console.error("Error fetching agent:", error);
                notFound();
            } finally {
                setLoading(false);
            }
        };

        fetchAgent();
    }, [id]);

    if (loading) {
        return <div>Loading...</div>;
    }

    if (!agent) {
        return notFound();
    }

    return <AgentForm agent={agent} />;
}