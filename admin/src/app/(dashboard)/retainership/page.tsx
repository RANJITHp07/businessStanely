"use client";

import { useState, useEffect } from "react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import Link from "next/link";
import { toast } from "react-toastify";
import { Retainership } from "@/types";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CheckCircle,
  Clock,
  Edit,
  Eye,
  Filter,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";

export default function RetainershipTable() {
  const [retainerships, setRetainerships] = useState<Retainership[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  // Removed unused sortBy and sortByDate state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [retainershipToDelete, setRetainershipToDelete] =
    useState<Retainership | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("approved");
  const [currentUserRole, setCurrentUserRole] = useState<string>("");

  const router = useRouter();

  // Get the current user's role from localStorage
  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        const userRole = user.adminType || "";
        setCurrentUserRole(userRole);

        // No longer restrict pending tab for non-owners
        // We'll use the isOwner flag for controlling actions instead
      } catch (error) {
        console.error("Error parsing user data:", error);
      }
    }
  }, [activeTab]);

  // State to store all retainerships for counting
  const [allRetainerships, setAllRetainerships] = useState<Retainership[]>([]);

  // Fetch all retainerships for counting tabs
  useEffect(() => {
    const fetchAllRetainerships = async () => {
      try {
        const response = await fetchWithAuth(`/api/retainerships`);

        if (!response.ok) {
          throw new Error("Failed to fetch all retainerships");
        }

        const data = await response.json();
        setAllRetainerships(data);
      } catch (error) {
        console.error("Error fetching all retainerships:", error);
        setAllRetainerships([]);
      }
    };
    fetchAllRetainerships();
  }, []);

  useEffect(() => {
    const fetchRetainerships = async () => {
      try {
        setLoading(true);
        // Fetch retainerships from API based on active tab
        const status = activeTab === "approved" ? "approved" : "pending";
        const response = await fetchWithAuth(
          `/api/retainerships?status=${status}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch retainerships");
        }

        const data = await response.json();
        setRetainerships(data);
      } catch (error) {
        console.error("Error fetching retainerships:", error);
        // Show empty state instead of mock data
        setRetainerships([]);
        if (error instanceof Error) {
          toast.error(error.message);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchRetainerships();
  }, [activeTab]);

  // Filter retainerships based on search and tab
  const filteredRetainerships = retainerships.filter((retainership) => {
    const matchesSearch =
      retainership.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (retainership.description?.toLowerCase() || "").includes(
        searchTerm.toLowerCase()
      ) ||
      (retainership.createdBy?.toLowerCase() || "").includes(
        searchTerm.toLowerCase()
      );

    const matchesTab = retainership.status === activeTab;

    return matchesSearch && matchesTab;
  });

  // Apply sorting to filtered retainerships
  const sortedRetainerships = filteredRetainerships;

  const resetFilters = () => {
    setSearchTerm("");
  };

  // Pagination logic
  const totalPages = Math.ceil(sortedRetainerships.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentRetainerships = sortedRetainerships.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number.parseInt(value));
    setCurrentPage(1);
  };

  const handleDelete = async () => {
    if (!retainershipToDelete) return;
    try {
      // Call API to delete retainership
      const response = await fetchWithAuth(
        `/api/task-retainerships/${retainershipToDelete.id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete retainership");
      }

      // Update both retainership lists in the UI
      setRetainerships(
        retainerships.filter(
          (retainership) => retainership.id !== retainershipToDelete.id
        )
      );
      setAllRetainerships(
        allRetainerships.filter(
          (retainership) => retainership.id !== retainershipToDelete.id
        )
      );
      setRetainershipToDelete(null);
      toast.success("Retainership deleted successfully");
    } catch (error) {
      console.error("Error deleting retainership:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to delete retainership";
      toast.error(errorMessage);
    }
  };

  // Get counts for tabs from allRetainerships to always show correct counts
  const approvedCount = allRetainerships.filter(
    (cat) => cat.status === "approved"
  ).length;
  const pendingCount = allRetainerships.filter(
    (cat) => cat.status === "pending"
  ).length;

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 md:mb-4">
          <div>
            <h1 className="text-[28px] md:text-3xl font-bold">
              Task Retainership Management
            </h1>
            <p className="text-[18px] md:text-[16px] text-muted-foreground mt-2">
              Manage and organize your task retainerships
            </p>
          </div>
          <Link href="/retainership/create" className="flex justify-end">
            <Button className="mt-[20px] md:mt-none bg-[#003459] hover:bg-[#003459] text-white rounded-lg px-4 py-2 flex items-center gap-2 cursor-pointer shadow-none hover:shadow-md transition-shadow duration-300">
              <Plus className="h-4 w-4" />
              Create Retainership
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
              Filter and search through your task retainerships
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
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label htmlFor="search">Search Retainerships</Label>
                    <div className="relative my-1">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="search"
                        placeholder="Search by name, description, or creator..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
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
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Retainerships Table with Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="approved" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Approved Retainerships ({approvedCount})
          </TabsTrigger>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pending Retainerships ({pendingCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="approved">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Approved Retainerships ({sortedRetainerships.length})
                </CardTitle>
                {/* <div className="flex items-center gap-2">
                                    <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                                    <Select value={sortBy} onValueChange={setSortBy}>
                                        <SelectTrigger className="md:w-32">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="a-z">A-Z</SelectItem>
                                            <SelectItem value="z-a">Z-A</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Select value={sortByDate} onValueChange={setSortByDate}>
                                        <SelectTrigger className="md:w-32">
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
                        <TableRow>
                          <TableHead>Retainership</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Created By</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentRetainerships.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={6}
                              className="text-center py-8 text-muted-foreground"
                            >
                              No approved retainerships found matching your
                              criteria.
                            </TableCell>
                          </TableRow>
                        ) : (
                          currentRetainerships.map((retainership) => (
                            <TableRow
                              key={retainership.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() =>
                                router.push(`/retainership/${retainership.id}`)
                              }
                            >
                              <TableCell className="w-12">
                                <div className="flex items-center space-x-3">
                                  <Avatar className="h-10 w-10">
                                    <AvatarImage
                                      src={retainership.photo || ""}
                                    />
                                    <AvatarFallback>
                                      {retainership.name
                                        .toUpperCase()
                                        .split(" ")
                                        .map((n) => n[0])
                                        .join("")}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="w-60">
                                    <div className="font-medium truncate">
                                      {retainership.name
                                        .charAt(0)
                                        .toUpperCase() +
                                        retainership.name.slice(1)}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      Created:{" "}
                                      {new Date(
                                        retainership.createdAt
                                      ).toLocaleDateString()}
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="max-w-xs">
                                  <p
                                    className="text-sm"
                                    title={retainership.description || ""}
                                  >
                                    {(retainership.description?.length ?? 0) >
                                      30
                                      ? `${retainership.description?.slice(
                                        0,
                                        30
                                      )}...`
                                      : retainership.description || ""}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  {retainership.createdBy || "Unknown"}
                                  {retainership.createdByType === "agent" && (
                                    <span className="ml-1 text-xs text-blue-600">
                                      (Agent)
                                    </span>
                                  )}
                                  {retainership.createdByType === "user" &&
                                    retainership.createdByRole === "owner" && (
                                      <span className="ml-1 text-xs text-purple-600">
                                        (Owner)
                                      </span>
                                    )}
                                  {retainership.createdByType === "user" &&
                                    retainership.createdByRole === "admin" && (
                                      <span className="ml-1 text-xs text-green-600">
                                        (Admin)
                                      </span>
                                    )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm w-60 truncate">
                                  {(() => {
                                    const organizationName = retainership.client?.organizationName;
                                    const fullName = organizationName ||
                                      `${retainership.client?.firstName || ""} ${retainership.client?.lastName || ""}`.trim() ||
                                      "N/A";
                                    const displayName = fullName.length > 30 ? `${fullName.slice(0, 30)}...` : fullName;

                                    return (
                                      <>
                                        <p title={fullName}>{displayName}</p>
                                        <p className="text-muted-foreground text-xs">
                                          {retainership.client?.email || "N/A"}
                                        </p>
                                      </>
                                    );
                                  })()}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      className="h-8 w-8 p-0"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <span className="sr-only">Open menu</span>
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>
                                      Actions
                                    </DropdownMenuLabel>
                                    <DropdownMenuItem asChild>
                                      <Link
                                        href={`/retainership/${retainership.id}`}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <Eye className="mr-2 h-4 w-4" />
                                        View Details
                                      </Link>
                                    </DropdownMenuItem>
                                    {currentUserRole === "owner" && (
                                      <>
                                        <DropdownMenuItem asChild>
                                          <Link
                                            href={`/retainership/${retainership.id}/edit`}
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <Edit className="mr-2 h-4 w-4" />
                                            Edit Retainership
                                          </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          className="text-destructive"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setRetainershipToDelete(
                                              retainership
                                            );
                                          }}
                                        >
                                          <Trash2 className="mr-2 h-4 w-4" />
                                          Delete Retainership
                                        </DropdownMenuItem>
                                      </>
                                    )}
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
                          <ChevronsLeft className="h-4 w-4" />
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
                        {Array.from(
                          { length: Math.min(5, totalPages) },
                          (_, i) => {
                            const pageNumber =
                              Math.max(
                                1,
                                Math.min(totalPages - 4, currentPage - 2)
                              ) + i;
                            if (pageNumber <= totalPages) {
                              return (
                                <Button
                                  key={pageNumber}
                                  variant={
                                    currentPage === pageNumber
                                      ? "default"
                                      : "outline"
                                  }
                                  size="sm"
                                  onClick={() => handlePageChange(pageNumber)}
                                >
                                  {pageNumber}
                                </Button>
                              );
                            }
                            return null;
                          }
                        )}
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
        </TabsContent>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Pending Retainerships ({sortedRetainerships.length})
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
                        <TableRow>
                          <TableHead>Retainership</TableHead>
                          <TableHead>Description</TableHead>
                          {/* <TableHead>Status</TableHead> */}
                          <TableHead>Created By</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentRetainerships.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={6}
                              className="text-center py-8 text-muted-foreground"
                            >
                              No pending retainerships found matching your
                              criteria.
                            </TableCell>
                          </TableRow>
                        ) : (
                          currentRetainerships.map((retainership) => (
                            <TableRow
                              key={retainership.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() =>
                                router.push(
                                  `/retainership/approve/${retainership.id}`
                                )
                              }
                            >
                              <TableCell>
                                <div className="flex items-center space-x-3">
                                  <Avatar className="h-10 w-10">
                                    <AvatarImage
                                      src={retainership.photo || ""}
                                    />
                                    <AvatarFallback>
                                      {retainership.name
                                        .toUpperCase()
                                        .split(" ")
                                        .map((n) => n[0])
                                        .join("")}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="w-60">
                                    <div className="font-medium truncate">
                                      {retainership.name
                                        .charAt(0)
                                        .toUpperCase() +
                                        retainership.name.slice(1)}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      Created:{" "}
                                      {new Date(
                                        retainership.createdAt
                                      ).toLocaleDateString()}
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="max-w-xs">
                                  <p
                                    className="text-sm truncate"
                                    title={retainership.description}
                                  >
                                    {retainership.description}
                                  </p>
                                </div>
                              </TableCell>
                              {/* <TableCell>{getStatusBadge(retainership.status)}</TableCell> */}
                              <TableCell>
                                <div className="text-sm">
                                  {retainership.createdBy || "Unknown"}
                                  {retainership.createdByType === "agent" && (
                                    <span className="ml-1 text-xs text-blue-600">
                                      (Agent)
                                    </span>
                                  )}
                                  {retainership.createdByType === "user" &&
                                    retainership.createdByRole === "owner" && (
                                      <span className="ml-1 text-xs text-purple-600">
                                        (Owner)
                                      </span>
                                    )}
                                  {retainership.createdByType === "user" &&
                                    retainership.createdByRole === "admin" && (
                                      <span className="ml-1 text-xs text-green-600">
                                        (Admin)
                                      </span>
                                    )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  <p>
                                    {retainership.client?.organizationName ||
                                      `${retainership.client?.firstName || ""
                                        } ${retainership.client?.lastName || ""
                                        }`.trim() ||
                                      "N/A"}
                                  </p>
                                  <p className="text-muted-foreground text-xs">
                                    {retainership.client?.email || "N/A"}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      className="h-8 w-8 p-0"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <span className="sr-only">Open menu</span>
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>
                                      Actions
                                    </DropdownMenuLabel>
                                    <DropdownMenuItem asChild>
                                      <Link
                                        href={`/retainership/${retainership.id}`}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <Eye className="mr-2 h-4 w-4" />
                                        View Details
                                      </Link>
                                    </DropdownMenuItem>
                                    {currentUserRole === "owner" && (
                                      <DropdownMenuItem asChild>
                                        <Link
                                          href={`/retainership/approve/${retainership.id}`}
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <CheckCircle className="mr-2 h-4 w-4" />
                                          Approve/Reject Retainership
                                        </Link>
                                      </DropdownMenuItem>
                                    )}
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
                          <ChevronsLeft className="h-4 w-4" />
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
                        {Array.from(
                          { length: Math.min(5, totalPages) },
                          (_, i) => {
                            const pageNumber =
                              Math.max(
                                1,
                                Math.min(totalPages - 4, currentPage - 2)
                              ) + i;
                            if (pageNumber <= totalPages) {
                              return (
                                <Button
                                  key={pageNumber}
                                  variant={
                                    currentPage === pageNumber
                                      ? "default"
                                      : "outline"
                                  }
                                  size="sm"
                                  onClick={() => handlePageChange(pageNumber)}
                                >
                                  {pageNumber}
                                </Button>
                              );
                            }
                            return null;
                          }
                        )}
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
        </TabsContent>
      </Tabs>

      <AlertDialog
        open={!!retainershipToDelete}
        onOpenChange={() => setRetainershipToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              task retainership and may affect existing tasks Ownership to this
              retainership.
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
