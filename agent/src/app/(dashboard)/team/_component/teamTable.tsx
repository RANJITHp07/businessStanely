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
import { Users, Search, Filter, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
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
  };
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("All Types");
  const [selectedJurisdiction, setSelectedJurisdiction] =
    useState("All Jurisdictions");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  // Removed teamToDelete state
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
  const response = await fetchWithAuth("/api/team-members");
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

  function getAgentTypeBadge(type?: string) {
    const colors: Record<string, string> = {
      "Senior Partner": "bg-purple-100 text-purple-800",
      Partner: "bg-blue-100 text-blue-800",
      Associate: "bg-green-100 text-green-800",
      "Junior Associate": "bg-yellow-100 text-yellow-800",
      Paralegal: "bg-orange-100 text-orange-800",
      "Legal Assistant": "bg-gray-100 text-gray-800",
    };
    return (
      <Badge className={colors[type || ""] || "bg-gray-100 text-gray-800"}>
        {type || "Unknown"}
      </Badge>
    );
  }

  return (
    <div className=" container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 md:mb-4">
          <div>
            <h1 className="text-[28px] md:text-3xl font-bold">Team Members</h1>
            <p className="text-[18px] md:text-[16px] text-muted-foreground mt-2">
              View and manage your team members
            </p>
          </div>
          {/* Optionally add a button for inviting/adding team members here */}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters & Search
            </CardTitle>
            <CardDescription>
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
                {" "}
                {/* Search */}
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label htmlFor="search">Search Agents</Label>
                    <div className="relative my-1">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="search"
                        placeholder="Search by name, email, or specialization..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>
                {/* Filter Controls */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Agent Type</Label>
                    <Select
                      value={selectedType}
                      onValueChange={setSelectedType}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {agentTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Jurisdiction</Label>
                    <Select
                      value={selectedJurisdiction}
                      onValueChange={setSelectedJurisdiction}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {jurisdictions.map((jurisdiction) => (
                          <SelectItem key={jurisdiction} value={jurisdiction}>
                            {jurisdiction}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {/* Results Summary */}
                <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
                  <Button
                    className="cursor-pointer hover:text-white text-white bg-[#f42b03] hover:bg-[#f42b03] rounded-lg px-4 py-2 shadow-none hover:shadow-lg transition-shadow duration-300"
                    variant="outline"
                    onClick={resetFilters}
                  >
                    Clear
                  </Button>
                </div>{" "}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Agents Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Members ({sortedTeams.length})
            </CardTitle>
            {/* <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a-z">A-Z</SelectItem>
                  <SelectItem value="z-a">Z-A</SelectItem>
                </SelectContent>
              </Select>
              <Select  >
  <SelectTrigger className="w-38">
    <SelectValue className="text-black" placeholder="Jurisdiction" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="newest">Usa</SelectItem>
    <SelectItem value="oldest">India</SelectItem>
  </SelectContent>
</Select>

              <Select value={sortByDate} onValueChange={setSortByDate}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                </SelectContent>
              </Select>
            </div> */}
          </div>
        </CardHeader>

        {loading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow isHeader>
                      <TableHead>Team Member</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Specializations</TableHead>
                      <TableHead>Jurisdiction</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {currentTeams.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No teams found matching your criteria.
                        </TableCell>
                      </TableRow>
                    ) : (
                      currentTeams.map((team) => {
                        return (
                          <TableRow
                            key={team.id}
                            onClick={() => router.push(`/team/${team.id}`)}
                            className="cursor-pointer hover:bg-muted/50"
                          >
                            <TableCell>
                              <div className="flex items-center space-x-3">
                                <Avatar className="h-10 w-10">
                                  <AvatarImage src={team.photo || ""} />
                                  <AvatarFallback>
                                    {team.name
                                      .toUpperCase()
                                      .split(" ")
                                      .map((n) => n[0])
                                      .join("")}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium">
                                    {team.name.charAt(0).toUpperCase() +
                                      team.name.slice(1)}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {team.email}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{team.type}</TableCell>
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
                            <TableCell>{team.jurisdiction}</TableCell>
                            {/* Actions removed: no edit/delete menu */}
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between space-x-2 py-4">
                  <div className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Select
                      value={itemsPerPage.toString()}
                      onValueChange={handleItemsPerPageChange}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[5, 10, 20, 50].map((value) => (
                          <SelectItem key={value} value={value.toString()}>
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
                    >
                      <ChevronsLeft className="h-4 w-4 " />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    {/* Page Numbers */}
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
                          >
                            {pageNumber}
                          </Button>
                        );
                      }
                      return null;
                    })}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(totalPages)}
                      disabled={currentPage === totalPages}
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