"use client";
import { useState, useEffect } from "react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
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
import { Users, Search, Filter, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, MoreHorizontal, Eye } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { hasAdvisorRole, hasExecutionRole } from "@/lib/agentRole";
import { useTablePage } from "@/hooks/useTablePage";
// Removed Link import
// Removed AlertDialog and related imports

const agentTypes = [
  "All Types",
  "Owner",
  "Partner",
  "CEO",
  "Senior Manager",
  "Manager",
  "Senior Executive",
  "Executive",
  "Junior Executive",
  "Trainee",
  "Intern",
];
const jurisdictions = ["All Jurisdictions", "India", "USA", "UAE", "Others"];

export default function TeamsTable() {
  type Team = {
    id: string;
    name: string;
    type?: string;
    specializations?: string[];
    jurisdiction?: string;
    email?: string;
    photo?: string;
    agentType?: string;
    agentRole?: string;
  };
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("All Types");
  const [selectedJurisdiction, setSelectedJurisdiction] =
    useState("All Jurisdictions");
  const { currentPage, setCurrentPage, itemsPerPage, setItemsPerPage, clampToTotalPages } =
      useTablePage("agent-dashboard-team-_component-teamTable");
  // Removed teamToDelete state
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const response = await fetchWithAuth("/api/team-members?depth=direct");
        if (response.ok) {
          const data = await response.json();
          setTeams(data);
        } else {
          console.error("Failed to fetch teams");
        }
      } catch (error) {
        console.error("Error fetching teams:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTeams();
  }, []);

  const getDefaultTab = (team: Team) => {
    if (hasExecutionRole(team.agentRole) && hasAdvisorRole(team.agentRole)) {
      return "tasks";
    }

    if (hasAdvisorRole(team.agentRole)) {
      return "leads";
    }

    return "tasks";
  };

  // Sort function
  const sortTeams = (teams: Team[]) => {
    return [...teams].sort((a, b) => {
      return a.name.localeCompare(b.name);
    });
  };

  // Filter teams based on search and filters
  const filteredTeams = teams.filter((team) => {
    const matchesSearch =
      team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (team.email &&
        team.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (team.specializations &&
        team.specializations
          .join(", ")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()));

    const matchesType =
      selectedType === "All Types" || team.type === selectedType;
    const matchesJurisdiction =
      selectedJurisdiction === "All Jurisdictions" ||
      team.jurisdiction === selectedJurisdiction;

    return matchesSearch && matchesType && matchesJurisdiction;
  });

  // Apply sorting to filtered teams
  const sortedTeams = sortTeams(filteredTeams);

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedType("All Types");
    setSelectedJurisdiction("All Jurisdictions");
  };

  // Pagination logic
  const totalPages = Math.ceil(sortedTeams.length / itemsPerPage);

  useEffect(() => {
      clampToTotalPages(totalPages)
  }, [totalPages, clampToTotalPages]);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentTeams = sortedTeams.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number.parseInt(value));
    setCurrentPage(1);
  };

  // Removed handleDelete function

  return (
    <div className="w-full container mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-6 max-w-7xl">
      <div className="mb-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6 md:mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold break-words">Team Members</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-2">
              View and manage your team members
            </p>
          </div>
          {/* Optionally add a button for inviting/adding team members here */}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Filter className="h-5 w-5 flex-shrink-0" />
              <span className="truncate">Filters & Search</span>
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Filter and search through your agents
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <>
                <div className="h-[200px] w-full bg-gray-200 rounded-2xl mb-4"></div>
                <div className="flex justify-between gap-4">
                  <div className="h-5 w-1/2 bg-gray-200 rounded-xl mb-3"></div>
                  <div className="h-5 w-1/2 bg-gray-200 rounded-xl mb-3"></div>
                </div>
              </>
            ) : (
              <>
                {/* Search */}
                <div className="flex flex-col items-start gap-2 md:gap-4">
                  <div className="w-full">
                    <Label htmlFor="search" className="text-sm sm:text-base">Search Agents</Label>
                    <div className="relative mt-2">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="search"
                        placeholder="Search by name, email, or specialization..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 text-sm"
                      />
                    </div>
                  </div>
                </div>
                {/* Filter Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm sm:text-base">Agent Type</Label>
                    <Select
                      value={selectedType}
                      onValueChange={setSelectedType}
                    >
                      <SelectTrigger className="w-full text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {agentTypes.map((type) => (
                          <SelectItem key={type} value={type} className="text-sm">
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm sm:text-base">Jurisdiction</Label>
                    <Select
                      value={selectedJurisdiction}
                      onValueChange={setSelectedJurisdiction}
                    >
                      <SelectTrigger className="w-full text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {jurisdictions.map((jurisdiction) => (
                          <SelectItem key={jurisdiction} value={jurisdiction} className="text-sm">
                            {jurisdiction}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {/* Results Summary */}
                <div className="flex items-center justify-end gap-2 text-xs sm:text-sm text-muted-foreground">
                  <Button
                    className="cursor-pointer hover:text-white text-white bg-[#f42b03] hover:bg-[#f42b03] rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm shadow-none hover:shadow-lg transition-shadow duration-300"
                    variant="outline"
                    onClick={resetFilters}
                  >
                    Clear
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Agents Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Users className="h-5 w-5 flex-shrink-0" />
              <span className="truncate">Team Members ({sortedTeams.length})</span>
            </CardTitle>
          </div>
        </CardHeader>

        {loading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <CardContent className="p-3 sm:p-6">
              {/* Desktop Table View */}
              <div className="hidden md:block rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow isHeader>
                      <TableHead className="text-xs sm:text-sm">Team Member</TableHead>
                      <TableHead className="text-xs sm:text-sm">Type</TableHead>
                      <TableHead className="text-xs sm:text-sm">Specializations</TableHead>
                      <TableHead className="text-xs sm:text-sm">Jurisdiction</TableHead>
                      <TableHead className="text-xs sm:text-sm text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {currentTeams.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center py-8 text-sm text-muted-foreground"
                        >
                          No teams found matching your criteria.
                        </TableCell>
                      </TableRow>
                    ) : (
                      currentTeams.map((team) => {
                        return (
                          <TableRow
                            key={team.id}
                            onClick={() => router.push(`/team/${team.id}?tab=${getDefaultTab(team)}`)}
                            className="cursor-pointer hover:bg-muted/50"
                          >
                            <TableCell>
                              <div className="flex items-center space-x-3">
                                <Avatar className="h-10 w-10 flex-shrink-0">
                                  <AvatarImage src={team.photo || ""} />
                                  <AvatarFallback>
                                    {team.name
                                      .toUpperCase()
                                      .split(" ")
                                      .map((n) => n[0])
                                      .join("")}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <div className="font-medium text-sm truncate">
                                    {team.name.charAt(0).toUpperCase() +
                                      team.name.slice(1)}
                                  </div>
                                  <div className="text-xs text-muted-foreground truncate">
                                    {team.email}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">{team.type || team.agentType}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {team.specializations &&
                                  team.specializations
                                    .slice(0, 2)
                                    .map((spec) => (
                                      <Badge
                                        key={spec}
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        {spec}
                                      </Badge>
                                    ))}
                                {team.specializations &&
                                  team.specializations.length > 2 && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      +{team.specializations.length - 2}
                                    </Badge>
                                  )}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">{team.jurisdiction}</TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" className="h-8 w-8 p-0" onClick={e => e.stopPropagation()}>
                                    <span className="sr-only">Open menu</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel className="text-sm">Actions</DropdownMenuLabel>
                                  <DropdownMenuItem asChild>
                                    <a href={`/team/${team.id}?tab=${getDefaultTab(team)}`} onClick={e => e.stopPropagation()}>
                                      <Eye className="mr-2 h-4 w-4" />
                                      View Details
                                    </a>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Table View */}
              <div className="md:hidden border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow isHeader>
                      <TableHead className="text-xs">Team Member</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {currentTeams.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="text-center py-8 text-xs text-muted-foreground"
                        >
                          No teams found matching your criteria.
                        </TableCell>
                      </TableRow>
                    ) : (
                      currentTeams.map((team) => {
                        return (
                          <TableRow
                            key={team.id}
                            onClick={() => router.push(`/team/${team.id}?tab=${getDefaultTab(team)}`)}
                            className="cursor-pointer hover:bg-muted/50"
                          >
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Avatar className="h-8 w-8 flex-shrink-0">
                                  <AvatarImage src={team.photo || ""} />
                                  <AvatarFallback className="text-xs">
                                    {team.name
                                      .toUpperCase()
                                      .split(" ")
                                      .map((n) => n[0])
                                      .join("")}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <div className="font-medium text-xs truncate">
                                    {team.name.charAt(0).toUpperCase() +
                                      team.name.slice(1)}
                                  </div>
                                  <div className="text-xs text-muted-foreground truncate">
                                    {team.jurisdiction}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">
                              <div className="space-y-1">
                                <div className="font-medium">{team.type}</div>
                                <div className="flex flex-wrap gap-1">
                                  {team.specializations &&
                                    team.specializations
                                      .slice(0, 1)
                                      .map((spec) => (
                                        <Badge
                                          key={spec}
                                          variant="outline"
                                          className="text-xs"
                                        >
                                          {spec}
                                        </Badge>
                                      ))}
                                  {team.specializations &&
                                    team.specializations.length > 1 && (
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        +{team.specializations.length - 1}
                                      </Badge>
                                    )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
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
                                    <a href={`/team/${team.id}`}>
                                      <Eye className="mr-2 h-3 w-3" />
                                      <span className="text-xs">View Details</span>
                                    </a>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })
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

                    {/* Page Numbers - Hidden on mobile */}
                    <div className="hidden sm:flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const pageNumber =
                          Math.max(1, Math.min(totalPages - 4, currentPage - 2)) +
                          i;
                        if (pageNumber <= totalPages) {
                          return (
                            <Button
                              key={pageNumber}
                              variant={
                                currentPage === pageNumber ? "default" : "outline"
                              }
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
          </>
        )}
      </Card>
      {/* Removed AlertDialog for delete confirmation */}
    </div>
  );
}