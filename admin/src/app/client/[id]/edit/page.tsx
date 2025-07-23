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
  return <>
  <div className="px-[20px] py-[20px]  bg-[white]">
    <div className="animate-pulse">
      <div className="h-[200px] w-full bg-gray-200 rounded-2xl mb-4"></div>
      <div className="h-[400px] w-full bg-gray-200 rounded-2xl mb-4"></div>

      <div className="flex justify-between gap-4">
        <div className="h-[50px] w-1/2 bg-gray-200 rounded-xl mb-3"></div>
        <div className="h-[50px] w-1/2 bg-gray-200 rounded-xl mb-3"></div>
      </div>
    </div>
  </div>
</>


    }

    if (!client) {
        return notFound();
    }

    return <ClientForm client={client} />;
}