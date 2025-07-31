"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit, Loader2, Shield, User } from "lucide-react";
import { toast } from "react-toastify";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

interface Admin {
  id: string;
  username: string;
  email: string;
  adminType: "owner" | "admin";
}

export default function AdminDetailsPage() {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string>("");
  const params = useParams();

  // Get the current user's role from localStorage
  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setCurrentUserRole(user.adminType || "");
      } catch (error) {
        console.error("Error parsing user data:", error);
      }
    }
  }, []);

  useEffect(() => {
    const fetchAdmin = async () => {
      try {
        const response = await fetch(`/api/admins/${params.id}`);
        if (response.ok) {
          const data = await response.json();
          setAdmin(data);
        } else {
          toast.error("Failed to fetch admin details");
        }
      } catch (error) {
        console.error("Error fetching admin:", error);
        toast.error("An unexpected error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAdmin();
  }, [params.id]);

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
      {/* Header Skeleton */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 md:mb-4">
          <div>
            <Skeleton className="h-8 w-40 mb-2" />
            <Skeleton className="h-5 w-80" />
          </div>
          <Skeleton className="h-10 w-32 mt-[20px] md:mt-0" />
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


      </div>
  
   
    </div>
    );
  }

  if (!admin) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="text-center py-10">
          <h2 className="text-2xl font-bold mb-4">Admin Not Found</h2>
          <p className="mb-6">The admin you&apos;re looking for doesn&apos;t exist.</p>
          <Button asChild>
            <Link href="/admin">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Admin List
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Admin Details</h1>
          <div className="flex gap-4">
            <Button variant="outline" asChild>
              <Link href="/admin">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
            {currentUserRole === "owner" && (
              <Button asChild>
                <Link href={`/admin/${admin.id}/edit`}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Admin
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Admin Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Username</h3>
              <p className="text-lg">{admin.username}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Email</h3>
              <p className="text-lg">{admin.email}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Role</h3>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <p className="text-lg capitalize">{admin.adminType}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}