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
        return <div className="flex flex-col items-center justify-center min-h-screen bg-white"> <div className="w-12 h-12 border-[5px] border-t-blue-600 border-gray-300 rounded-full animate-spin  shadow-blue-100"></div> </div>
    }

    if (!agent) {
        return notFound();
    }

    return <AgentForm agent={agent} />;
}