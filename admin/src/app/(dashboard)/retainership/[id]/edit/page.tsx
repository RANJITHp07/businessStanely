'use client'

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { toast } from "react-toastify";
import { use } from 'react';
import Create from '../../create/page';

interface Retainership {
  id: string;
  name: string;
  description: string;
  client: {
    organizationName?: string;
    firstName?: string;
    lastName?: string;
  } | null;
  legislations: Array<{
    id: string;
    title: string;
    description: string;
    assignedAgent: string | { name: string };
  }>;
  photo?: string;
  status?: "approved" | "pending";
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function EditRetainershipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params); // Properly unwrap the params Promise using React.use()

  const router = useRouter();
  const [initialData, setInitialData] = useState<Retainership | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRetainership = async () => {
      try {
        const response = await fetchWithAuth(`/api/retainerships/${id}`);
        if (response.ok) {
          const data = await response.json();
          setInitialData(data);
        } else {
          toast.error('Failed to fetch retainership details.');
          router.push('/retainership');
        }
      } catch (error) {
        console.error('Error fetching retainership:', error);
        toast.error('An error occurred while fetching retainership details.');
        router.push('/retainership');
      } finally {
        setLoading(false);
      }
    };

    fetchRetainership();
  }, [id, router]);

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!initialData) {
    return null;
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <Create admin={{ id }} initialData={initialData} />
    </div>
  );
}
