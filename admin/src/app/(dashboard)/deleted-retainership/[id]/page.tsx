"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Gavel,
  Trash2,
  User,
} from "lucide-react";

interface DeletedLegislation {
  id: string;
  title: string;
  description?: string | null;
  assignedAgent?: string | null;
  assignedAgentId?: string | null;
  createdAt: string;
  deletedAt?: string | null;
  taskCount: number;
}

interface DeletedRetainershipDetail {
  retainership: {
    id: string;
    name: string;
    description: string;
    color: string;
    status: string;
    createdAt: string;
    deletedAt: string;
    deletedByType?: string | null;
    deletedBy?: string | null;
    createdBy: string;
    createdByType?: string | null;
    client?: { id: string; name: string; email?: string | null } | null;
  };
  legislations: DeletedLegislation[];
}

function formatDate(dateString?: string | null) {
  if (!dateString) return "-";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(dateString?: string | null) {
  if (!dateString) return "-";
  const d = new Date(dateString);
  return isNaN(d.getTime()) ? "-" : d.toLocaleString();
}

export default function DeletedRetainershipDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [data, setData] = useState<DeletedRetainershipDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const response = await fetchWithAuth(`/api/deleted-retainerships/${id}`);
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          setError(body.error ?? "Failed to load deleted retainership");
          return;
        }
        setData(await response.json());
      } catch (err) {
        console.error("Error fetching deleted retainership:", err);
        setError("Failed to load deleted retainership");
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchDetail();
  }, [id]);

  if (loading) {
    return (
      <section className="container mx-auto p-6 max-w-7xl space-y-8">
        <div className="h-[120px] w-full bg-gray-200 rounded-2xl" />
        <div className="h-[200px] w-full bg-gray-200 rounded-2xl" />
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="container mx-auto p-6 max-w-7xl space-y-4">
        <Button asChild variant="outline" className="w-fit">
          <Link href="/retainership">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Retainerships
          </Link>
        </Button>
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertTriangle className="h-4 w-4" />
          {error ?? "This deleted retainership could not be found."}
        </div>
      </section>
    );
  }

  const { retainership, legislations } = data;

  return (
    <section className="container mx-auto p-6 max-w-7xl space-y-8 overflow-x-hidden min-w-0">
      {/* Header */}
      <div>
        <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 md:mb-4 gap-4">
          <div>
            <h1 className="text-[28px] md:text-3xl font-bold">
              Deleted Retainership
            </h1>
            <p className="text-[18px] md:text-[16px] text-muted-foreground mt-2">
              Legislation hidden when this retainership was deleted
            </p>
          </div>
          <Button asChild variant="outline" className="w-fit">
            <Link href="/retainership">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Retainerships
            </Link>
          </Button>
        </div>

        {/* Retainership Summary Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-start justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-semibold">
                    {retainership.name}
                  </h2>
                  <Badge variant="destructive" className="gap-1">
                    <Trash2 className="h-3 w-3" />
                    Deleted
                  </Badge>
                </div>
                {retainership.description && (
                  <p className="text-sm text-muted-foreground max-w-2xl">
                    {retainership.description}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground pt-1">
                  <span className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    Created by {retainership.createdBy}
                  </span>
                  {retainership.client && (
                    <span className="flex items-center gap-1">
                      <Building2 className="h-4 w-4" />
                      {retainership.client.name}
                    </span>
                  )}
                  <span>Created {formatDate(retainership.createdAt)}</span>
                </div>
              </div>

              <div className="text-sm space-y-1 md:text-right">
                <div className="text-muted-foreground">
                  Deleted {formatDateTime(retainership.deletedAt)}
                </div>
                {retainership.deletedBy && (
                  <div className="text-muted-foreground">
                    by {retainership.deletedBy}
                    {retainership.deletedByType === "AGENT" && " (Agent)"}
                  </div>
                )}
                <div className="text-xs text-muted-foreground pt-1">
                  Status at deletion: {retainership.status}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gavel className="h-5 w-5" />
            Legislation ({legislations.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-6">
          {legislations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No legislation was hidden with this retainership.
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs sm:text-sm">
                      Title
                    </TableHead>
                    <TableHead className="text-xs sm:text-sm">
                      Assigned Agent
                    </TableHead>
                    <TableHead className="text-xs sm:text-sm">
                      Tasks
                    </TableHead>
                    <TableHead className="text-xs sm:text-sm">
                      Created
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {legislations.map((legislation) => (
                    <TableRow key={legislation.id}>
                      <TableCell>
                        <div className="font-medium text-sm">
                          {legislation.title}
                        </div>
                        {legislation.description && (
                          <div className="text-xs text-muted-foreground truncate max-w-md">
                            {legislation.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {legislation.assignedAgent ?? "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {legislation.taskCount}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(legislation.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
