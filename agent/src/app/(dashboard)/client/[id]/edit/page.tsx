"use client";

import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useState, useEffect } from "react";
import ClientForm from "@/app/(dashboard)/client/_component/clientForm";
import { notFound, useParams } from "next/navigation";
import { Client } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
export default function EditClientPage() {
  const params = useParams();
  const id = params.id as string;
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchClient = async () => {
      try {
  const response = await fetchWithAuth(`/api/clients/${id}`);
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
                <CardContent className="p-6">
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
<Card className="h-[400px]">
                <CardContent className="p-6">
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
<Card className="h-[400px]">
                <CardContent className="p-6">
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
  }

  if (!client) {
    return notFound();
  }

  return <ClientForm client={client} />;
}