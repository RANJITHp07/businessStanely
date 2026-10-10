"use client";
import { useState } from "react";
import Link from "next/link";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, Search } from "lucide-react";
import DeletedAgentTable from "./deletedAgentTable";

const jurisdictions = ["All Jurisdictions", "India", "USA", "UAE", "Others"];

const pageConfig = {
  execution: {
    heading: "Deleted Agents",
    searchLabel: "Search Deleted Execution Agents",
    backHref: "/agent",
    backLabel: "Back to Execution Agents",
    agentTypes: [
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
    ],
  },
  advisor: {
    heading: "Deleted Client Advisors",
    searchLabel: "Search Deleted Client Advisors",
    backHref: "/dashboard/agent",
    backLabel: "Back to Client Advisors",
    agentTypes: ["All Types", "Lead Maker", "Client Advisor", "Client Manager"],
  },
};

/**
 * Deleted agents now live as the right-hand tab on the Execution Agent and
 * Client Advisor pages. The standalone /deleted-agent and
 * /dashboard/deleted-advisor routes stay so existing links keep resolving; the
 * shared table renders rows only, so the heading and filters are supplied here.
 */
export default function DeletedAgentPage({ role }: { role: "execution" | "advisor" }) {
  const config = pageConfig[role];
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("All Types");
  const [selectedJurisdiction, setSelectedJurisdiction] = useState("All Jurisdictions");

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedType("All Types");
    setSelectedJurisdiction("All Jurisdictions");
  };

  return (
    <div className="w-full container mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-6 max-w-7xl">
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold break-words">
            {config.heading}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-2">
            Agents that were deleted; restore one to make it active again
          </p>
        </div>
        <Link href={config.backHref} className="w-full md:w-auto">
          <Button
            variant="outline"
            className="w-full md:w-auto rounded-lg px-4 py-2 flex items-center justify-center gap-2 cursor-pointer"
          >
            {config.backLabel}
          </Button>
        </Link>
      </div>

      <Card className="mb-6 md:mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
          <CardDescription>Filter and search through deleted agents</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="w-full">
            <Label htmlFor="search" className="text-sm sm:text-base">{config.searchLabel}</Label>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search by name, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            <div className="space-y-2">
              <Label className="text-sm sm:text-base">Agent Type</Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {config.agentTypes.map((type) => (
                    <SelectItem key={type} value={type} className="text-sm">
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm sm:text-base">Jurisdiction</Label>
              <Select value={selectedJurisdiction} onValueChange={setSelectedJurisdiction}>
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

          <div className="flex items-center justify-end gap-2 text-xs sm:text-sm text-muted-foreground">
            <Button
              onClick={resetFilters}
              className="cursor-pointer hover:text-white text-white bg-[#f42b03] hover:bg-[#f42b03] rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm shadow-none hover:shadow-lg transition-shadow duration-300"
              variant="outline"
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      <DeletedAgentTable
        role={role}
        searchTerm={searchTerm}
        selectedType={selectedType}
        selectedJurisdiction={selectedJurisdiction}
      />
    </div>
  );
}
