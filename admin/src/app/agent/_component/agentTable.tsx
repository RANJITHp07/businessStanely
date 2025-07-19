"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react"
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
} from "lucide-react";
import Link from "next/link";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

import { Agent } from "@/types";

export default function AgentsTable() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("All Types");
  const [selectedJurisdiction, setSelectedJurisdiction] =
    useState("All Jurisdictions");
  const [sortBy, setSortBy] = useState("a-z");
  const [sortByDate, setSortByDate] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const response = await fetch("/api/agents");
        if (response.ok) {
          const data = await response.json();
          setAgents(data);
        } else {
          console.error("Failed to fetch agents");
        }
      } catch (error) {
        console.error("Error fetching agents:", error);
      }
      finally {
        setLoading(false);
    }
    };

    fetchAgents();
  }, []);

  // Sort function
  const sortAgents = (agents: Agent[], sortBy: string, sortByDate: string) => {
    return [...agents].sort((a, b) => {
      if (sortBy === "a-z") {
        return a.name.localeCompare(b.name);
      } else if (sortBy === "z-a") {
        return b.name.localeCompare(a.name);
      }
      
      // Date sorting (assuming agents have a createdAt field)
      // if (sortByDate === "newest") {
      //   return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      // } else if (sortByDate === "oldest") {
      //   return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      // }
      
      return 0;
    });
  }

  // Filter agents based on search and filters
  const filteredAgents = agents.filter((agent) => {
    const matchesSearch =
      agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.specializations
        .join(", ")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

    const matchesType =
      selectedType === "All Types" || agent.agentType === selectedType;
    const matchesJurisdiction =
      selectedJurisdiction === "All Jurisdictions" ||
      agent.jurisdiction === selectedJurisdiction;

    return matchesSearch && matchesType && matchesJurisdiction;
  });

  // Apply sorting to filtered agents
  const sortedAgents = sortAgents(filteredAgents, sortBy, sortByDate);

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedType("All Types");
    setSelectedJurisdiction("All Jurisdictions");
  };

  // Pagination logic
  const totalPages = Math.ceil(sortedAgents.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentAgents = sortedAgents.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number.parseInt(value));
    setCurrentPage(1);
  };

  const handleDelete = async () => {
    if (!agentToDelete) return;

    try {
      const response = await fetch(`/api/agents/${agentToDelete.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setAgents(agents.filter((agent) => agent.id !== agentToDelete.id));
        setAgentToDelete(null);
      } else {
        console.error("Failed to delete agent");
      }
    } catch (error) {
      console.error("Error deleting agent:", error);
    }
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

  return (
    <div className=" container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <div className="flex  flex-col md:flex-row  justify-between md:items-center  mb-6 md:mb-4">
          <div>
            <h1 className="text-[28px] md:text-3xl font-bold">
              Agent Management
            </h1>
            <p className=" text-[18px] md:text-[16px]  text-muted-foreground mt-2">
              Manage and organize your legal team members
            </p>
          </div>
          <Link href="/agent/create" className="flex justify-end">
            <Button className=" mt-[20px] md:mt-none   bg-[#003459] hover:bg-[#003459] text-white rounded-lg px-4 py-2 flex items-center gap-2 cursor-pointer shadow-none hover:shadow-md transition-shadow duration-300">
              <Plus className="h-4 w-4" />
              Create Agent
            </Button>
          </Link>
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
             </div></>    
          ) : (  <>       {/* Search */}
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
                <Select value={selectedType} onValueChange={setSelectedType}>
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
            </div> </> )}
     
          </CardContent>
        </Card>
      </div>

      {/* Agents Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Agents ({sortedAgents.length})
            </CardTitle>
            <div className="flex items-center gap-2">
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
            </div>
          </div>
        </CardHeader>


{loading ?(<div className="flex justify-center items-center py-8">
  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
</div>
)  : (  <>
  <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Specializations</TableHead>
                  <TableHead>Jurisdiction</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentAgents.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No agents found matching your criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  currentAgents.map((agent) => (
                    <TableRow key={agent.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={agent.photo || ""} />
                            <AvatarFallback>
                              {agent.name
                                .toUpperCase()
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">
                              {agent.name.charAt(0).toUpperCase() +
                                agent.name.slice(1)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {agent.email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getAgentTypeBadge(agent.agentType)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {agent.specializations.slice(0, 2).map((spec) => (
                            <Badge
                              key={spec}
                              variant="outline"
                              className="text-xs"
                            >
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
                      <TableCell>{agent.jurisdiction}</TableCell>
                      <TableCell className="text-right">
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
                              <Link href={`/agent/${agent.id}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/agent/${agent.id}/edit`}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit Agent
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setAgentToDelete(agent)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Agent
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
                    Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
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

</>   ) }


   




      </Card>
      <AlertDialog
        open={!!agentToDelete}
        onOpenChange={() => setAgentToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              agent and remove their data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 