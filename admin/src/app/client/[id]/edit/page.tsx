"use client"

import { useState, useEffect } from 'react';
import ClientForm from '@/app/client/_component/clientForm';
import { notFound, useParams } from 'next/navigation';
import { Client } from '@/types';

export default function EditClientPage() {
    const params = useParams();
    const id = params.id as string;
    const [client, setClient] = useState<Client | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        const fetchClient = async () => {
            try {
                const response = await fetch(`/api/clients/${id}`);
                if (response.ok) {
                    const data = await response.json();
                    setClient(data);
                } else {
                    notFound();
                }
            } catch (error) {
                console.error("Error fetching client:", error);
                notFound();
            } finally {
                setLoading(false);
            }
        };

        fetchClient();
    }, [id]);

    if (loading) {
        return <div className="flex flex-col items-center justify-center min-h-screen bg-white"> <div className="w-12 h-12 border-[5px] border-t-blue-600 border-gray-300 rounded-full animate-spin  shadow-blue-100"></div> </div>
    }

    if (!client) {
        return notFound();
    }

    return <ClientForm client={client} />;
}