"use client";

import { useState, useEffect } from "react";
import AgentForm from "@/app/(dashboard)/agent/_component/agentForm";
import { notFound } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Agent } from "@/types";

export default function EditAgentPage({
  params: { id },
}: {
  params: { id: string };
}) {
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
   return (
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header Skeleton */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 md:mb-4">
            <div>
              <Skeleton className="h-8 w-40 mb-2" />
              <Skeleton className="h-5 w-80" />
            </div>
           
          </div>
          <Card>
            <CardContent className="p-6 h-[300px]">
              <div className="space-y-4">
                <Skeleton className="h-6 w-1/2 mb-2" />
                <Skeleton className="h-4 w-full mb-4" />
                <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 p-0 md:p-4 bg-muted/30 rounded-lg">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-40 md:ml-auto" />
                </div>
              </div>
            </CardContent>
          </Card>

<div className="mt-[30px]">   <Card >
            <CardContent className="p-6  h-[400px]">
              <div className="space-y-4">
                <Skeleton className="h-6 w-1/2 mb-2" />
                <Skeleton className="h-4 w-full mb-4" />
                <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 p-0 md:p-4 bg-muted/30 rounded-lg">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-40 md:ml-auto" />
                </div>
              </div>
            </CardContent>
          </Card></div>

          <div className="mt-[30px]">   <Card >
            <CardContent className="p-6  h-[200px]">
              <div className="space-y-4">
                <Skeleton className="h-6 w-1/2 mb-2" />
                <Skeleton className="h-4 w-full mb-4" />
                <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 p-0 md:p-4 bg-muted/30 rounded-lg">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-40 md:ml-auto" />
                </div>
              </div>
            </CardContent>
          </Card></div>

       
        </div>
      

      </div>
    );
  }

  if (!agent) {
    return notFound();
  }

  return <AgentForm agent={agent} />;
}