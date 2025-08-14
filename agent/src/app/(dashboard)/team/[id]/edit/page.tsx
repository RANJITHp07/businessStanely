"use client";

import { useState, useEffect } from "react";
import * as React from "react";
import TeamsForm from "../../_component/TeamsForm";
import { notFound } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";


export default function EditAgentPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  // Unwrap params using React.use() for future Next.js compatibility
  const resolvedParams = params instanceof Promise ? React.use(params) : params;
  const { id } = resolvedParams;
  type TeamMember = {
    id: string;
    name: string;
  };
  type Team = {
    id: string;
    name: string;
    email?: string;
    photo?: string;
    subordinates?: TeamMember[];
  };
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeam = async () => {
      try {
        const response = await fetch(`/api/teams/${id}`);
        if (response.ok) {
          const data = await response.json();
          setTeam(data);
        } else {
          notFound();
        }
      } catch (error) {
        console.error("Error fetching team:", error);
        notFound();
      } finally {
        setLoading(false);
      }
    };
    fetchTeam();
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

          <div className="mt-[30px]">
            {" "}
            <Card>
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
            </Card>
          </div>

          <div className="mt-[30px]">
            {" "}
            <Card>
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
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!team) {
    return notFound();
  }

  return <TeamsForm team={team} />;
}