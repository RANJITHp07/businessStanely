"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Loader2,
  MoreHorizontal,
  Eye,
  RotateCcw,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Agent } from "@/types";
import { getAdvisorType, hasAdvisorRole, hasExecutionRole } from "@/lib/agentRole";
import { sanitizeInactiveAgentEmail } from "@/lib/agentEmail";
import { useTablePage } from "@/hooks/useTablePage";
import RestoreAgentDialog from "./restoreAgentDialog";

type DeletedAgentRole = "execution" | "advisor";

// Per-portal differences: which role a deleted agent must have held to be
// listed, how its type is read, and which tab its detail page opens on.
const roleConfig: Record<
  DeletedAgentRole,
  {
    title: string;
    hasRole: (role?: string | null) => boolean;
    typeOf: (agent: Agent) => string;
    detailTab: string;
    pageKey: string;
  }
> = {
  execution: {
    title: "Deleted Execution Agents",
    hasRole: hasExecutionRole,
    typeOf: (agent) => agent.agentType,
    detailTab: "tasks",
    pageKey: "admin-dashboard-deleted-agent-page",
  },
  advisor: {
    title: "Deleted Client Advisors",
    hasRole: hasAdvisorRole,
    typeOf: (agent) => getAdvisorType(agent) || agent.agentType,
    detailTab: "leads",
    pageKey: "admin-sales-dashboard-deleted-advisor-page",
  },
};

const getAgentTypeBadge = (type: string) => {
  const colors = {
    "Senior Partner": "bg-purple-100 text-purple-800",
    Partner: "bg-blue-100 text-blue-800",
    Associate: "bg-green-100 text-green-800",
    "Junior Associate": "bg-yellow-100 text-yellow-800",
    Paralegal: "bg-orange-100 text-orange-800",
    "Legal Assistant": "bg-gray-100 text-gray-800",
  };

  return (
    <Badge
      className={
        colors[type as keyof typeof colors] || "bg-gray-100 text-gray-800"
      }
    >
      {type}
    </Badge>
  );
};

/**
 * The deleted-agents list, rendered as the right-hand tab on the Execution
 * Agent and Client Advisor pages, and on their standalone /deleted-agent and
 * /dashboard/deleted-advisor routes, which are kept so existing links resolve.
 *
 * Filter values come from the parent so both tabs share one filters card.
 * `reloadKey` refetches after a delete on the active tab; `onRestored` lets the
 * parent refetch its active list, since a restored agent moves back there.
 * `onCountChange` reports the row count for the tab label.
 */
export default function DeletedAgentTable({
  role,
  searchTerm = "",
  selectedType = "All Types",
  selectedJurisdiction = "All Jurisdictions",
  reloadKey = 0,
  onCountChange,
  onRestored,
}: {
  role: DeletedAgentRole;
  searchTerm?: string;
  selectedType?: string;
  selectedJurisdiction?: string;
  reloadKey?: number;
  onCountChange?: (count: number) => void;
  onRestored?: () => void;
}) {
  const config = roleConfig[role];
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentToRestore, setAgentToRestore] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const { currentPage, setCurrentPage, itemsPerPage, setItemsPerPage, clampToTotalPages } =
    useTablePage(config.pageKey);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const response = await fetchWithAuth("/api/agents?status=inactive");
        if (response.ok) {
          const data = await response.json();
          const rows = data.filter((agent: Agent) => config.hasRole(agent.agentRole));
          setAgents(rows);
          onCountChange?.(rows.length);
        } else {
          console.error("Failed to fetch deleted agents");
        }
      } catch (error) {
        console.error("Error fetching deleted agents:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAgents();
    // onCountChange is only read inside the fetch; re-running on a new
    // function identity would refetch on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, reloadKey]);

  const filteredAgents = agents.filter((agent) => {
    const displayEmail = sanitizeInactiveAgentEmail(agent.email);
    const matchesSearch =
      agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      displayEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.specializations
        .join(", ")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

    const matchesType =
      selectedType === "All Types" || config.typeOf(agent) === selectedType;
    const matchesJurisdiction =
      selectedJurisdiction === "All Jurisdictions" ||
      agent.jurisdiction === selectedJurisdiction;

    return matchesSearch && matchesType && matchesJurisdiction;
  });

  const totalPages = Math.ceil(filteredAgents.length / itemsPerPage);

  useEffect(() => {
    clampToTotalPages(totalPages);
  }, [totalPages, clampToTotalPages]);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentAgents = filteredAgents.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number.parseInt(value));
    setCurrentPage(1);
  };

  const detailHref = (agent: Agent) => `/agent/${agent.id}?tab=${config.detailTab}`;

  const initials = (agent: Agent) =>
    agent.name
      .toUpperCase()
      .split(" ")
      .map((n) => n[0])
      .join("");

  const displayName = (agent: Agent) =>
    agent.name.charAt(0).toUpperCase() + agent.name.slice(1);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Trash2 className="h-5 w-5 flex-shrink-0" />
              <span className="truncate">{config.title} ({filteredAgents.length})</span>
            </CardTitle>
          </div>
        </CardHeader>

        {loading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <CardContent className="p-3 sm:p-6">
            {/* Desktop Table View */}
            <div className="hidden md:block rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow isHeader>
                    <TableHead className="text-xs sm:text-sm">Agent</TableHead>
                    <TableHead className="text-xs sm:text-sm">Type</TableHead>
                    <TableHead className="text-xs sm:text-sm">Specializations</TableHead>
                    <TableHead className="text-xs sm:text-sm">Jurisdiction</TableHead>
                    <TableHead className="text-xs sm:text-sm text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {currentAgents.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-8 text-sm text-muted-foreground"
                      >
                        No deleted agents found matching your criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    currentAgents.map((agent) => (
                      <TableRow
                        key={agent.id}
                        onClick={() => router.push(detailHref(agent))}
                        className="cursor-pointer hover:bg-muted/50"
                      >
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <Avatar className="h-10 w-10 flex-shrink-0">
                              <AvatarImage src={agent.photo || ""} />
                              <AvatarFallback>{initials(agent)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="font-medium text-sm truncate">
                                {displayName(agent)}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {sanitizeInactiveAgentEmail(agent.email)}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getAgentTypeBadge(config.typeOf(agent))}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {agent.specializations.slice(0, 2).map((spec) => (
                              <Badge key={spec} variant="outline" className="text-xs">
                                {spec}
                              </Badge>
                            ))}
                            {agent.specializations.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{agent.specializations.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{agent.jurisdiction}</TableCell>
                        <TableCell
                          className="text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem asChild>
                                <Link href={detailHref(agent)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setAgentToRestore(agent)}>
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Restore
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow isHeader>
                    <TableHead className="text-xs">Agent</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Specializations</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {currentAgents.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center py-8 text-xs text-muted-foreground"
                      >
                        No deleted agents found matching your criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    currentAgents.map((agent) => (
                      <TableRow
                        key={agent.id}
                        onClick={() => router.push(detailHref(agent))}
                        className="cursor-pointer hover:bg-muted/50"
                      >
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Avatar className="h-8 w-8 flex-shrink-0">
                              <AvatarImage src={agent.photo || ""} />
                              <AvatarFallback className="text-xs">{initials(agent)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="font-medium text-xs truncate">
                                {displayName(agent)}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {sanitizeInactiveAgentEmail(agent.email)}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{getAgentTypeBadge(config.typeOf(agent))}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-0.5">
                            {agent.specializations.slice(0, 1).map((spec) => (
                              <Badge key={spec} variant="outline" className="text-xs">
                                {spec}
                              </Badge>
                            ))}
                            {agent.specializations.length > 1 && (
                              <Badge variant="outline" className="text-xs">
                                +{agent.specializations.length - 1}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell
                          className="text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-7 w-7 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel className="text-xs">Actions</DropdownMenuLabel>
                              <DropdownMenuItem asChild>
                                <Link href={detailHref(agent)}>
                                  <Eye className="mr-2 h-3 w-3" />
                                  <span className="text-xs">View Details</span>
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setAgentToRestore(agent)}>
                                <RotateCcw className="mr-2 h-3 w-3" />
                                <span className="text-xs">Restore</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-6 pt-4 border-t">
                <div className="text-xs sm:text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex items-center flex-wrap gap-2">
                  <Select
                    value={itemsPerPage.toString()}
                    onValueChange={handleItemsPerPageChange}
                  >
                    <SelectTrigger className="w-24 text-xs sm:text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[5, 10, 20, 50].map((value) => (
                        <SelectItem key={value} value={value.toString()} className="text-xs sm:text-sm">
                          {value} / page
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1}
                    className="text-xs"
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="text-xs"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  {/* Page Numbers */}
                  <div className="hidden sm:flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNumber =
                        Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                      if (pageNumber <= totalPages) {
                        return (
                          <Button
                            key={pageNumber}
                            variant={currentPage === pageNumber ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageChange(pageNumber)}
                            className="text-xs"
                          >
                            {pageNumber}
                          </Button>
                        );
                      }
                      return null;
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="text-xs"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(totalPages)}
                    disabled={currentPage === totalPages}
                    className="text-xs"
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      <RestoreAgentDialog
        agent={agentToRestore}
        kind="agent"
        open={!!agentToRestore}
        onOpenChange={(open) => {
          if (!open) setAgentToRestore(null);
        }}
        onRestored={() => {
          const restoredId = agentToRestore?.id;
          const remaining = agents.filter((a) => a.id !== restoredId);
          setAgents(remaining);
          onCountChange?.(remaining.length);
          onRestored?.();
        }}
      />
    </>
  );
}
