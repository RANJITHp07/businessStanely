"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, FileText, Calendar, User } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ServiceRecord {
  id: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  createdByUser: {
    id: string;
    name: string;
    email: string;
  };
}

interface Agent {
  id: string;
  name: string;
  email: string;
}

export default function ServiceRecords() {
  const [serviceRecords, setServiceRecords] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null);

  useEffect(() => {
    const fetchCurrentAgent = async () => {
      try {
        const agentData = localStorage.getItem("agent");
        if (!agentData) {
          setError("Agent information not found. Please log in again.");
          return;
        }
        
        const agent = JSON.parse(agentData);
        setCurrentAgent(agent);
        
        // Fetch service records for the current agent
        await fetchServiceRecords(agent.id);
      } catch (err) {
        console.error("Error loading agent data:", err);
        setError("Failed to load agent information.");
      }
    };

    fetchCurrentAgent();
  }, []);

  const fetchServiceRecords = async (agentId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/service-records?agentId=${agentId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setServiceRecords(data.serviceRecords || []);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to fetch service records");
      }
    } catch (err) {
      console.error("Error fetching service records:", err);
      setError("Failed to load service records");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDateShort = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert className="max-w-2xl mx-auto">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Instructions and Service Records</h1>
          <p className="text-gray-600">
            View all instructions and service records and notes from administrators
          </p>
        </div>
      </div>

      {/* {currentAgent && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Agent Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Name</p>
                <p className="text-lg font-semibold">{currentAgent.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Email</p>
                <p className="text-lg">{currentAgent.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )} */}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : serviceRecords.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">
              No Instructions and Service Records Found
            </h3>
            <p className="text-gray-500 text-center max-w-md">
              You don&apos;t have any instructions and service records yet. Instructions and service records will appear here when administrators add notes about your services.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Instructions and Service Records ({serviceRecords.length})
            </h2>
          </div>
          
          {serviceRecords.map((record) => (
            <Card key={record.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">
                    Instructions and Service Record
                  </CardTitle>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDateShort(record.createdAt)}
                  </Badge>
                </div>
                <CardDescription className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Added by {record.createdByUser.name}
                  <span className="text-gray-400">•</span>
                  {formatDate(record.createdAt)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                    {record.note}
                  </p>
                </div>
                {record.updatedAt !== record.createdAt && (
                  <p className="text-xs text-gray-500 mt-2">
                    Last updated: {formatDate(record.updatedAt)}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}