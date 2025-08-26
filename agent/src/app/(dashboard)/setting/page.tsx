"use client";

import { fetchWithAuth } from "@/lib/fetchWithAuth";
import type React from "react";
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
import { Separator } from "@/components/ui/separator";
import { toast } from "react-toastify";
import { Eye, EyeOff, Save, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Agent {
  id: string;
  name: string;
  email: string;
  agentType: string;
  phoneNumber: string;
  jurisdiction: string;
  specializations: string[];
  photo?: string;
  status: string;
}

export default function AgentSettingsPage() {
  // Agent state
  const [agent, setAgent] = useState<Agent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);

  // Profile state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [agentType, setAgentType] = useState("");
  const [barAssociationId, setBarAssociationId] = useState("");
  
  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Load agent data from localStorage on component mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    const agentDataString = localStorage.getItem("agent");

    if (token && agentDataString) {
      try {
        const agentData = JSON.parse(agentDataString);
        setAgent(agentData);
        setName(agentData.name || "");
        setEmail(agentData.email || "");
        setPhoneNumber(agentData.phoneNumber || "");
        setAgentType(agentData.agentType || "");
        setBarAssociationId(agentData.barAssociationId || "");
        setIsLoading(false);
      } catch {
        console.error("Error parsing agent data");
        // Redirect to login if data is corrupted
        window.location.href = "/login";
      }
    } else {
      // If no localStorage data, fetch from API
      fetchAgentProfile();
    }
  }, []);

  const fetchAgentProfile = async () => {
    try {
  const response = await fetchWithAuth("/api/auth/me");
      
      if (response.ok) {
        const data = await response.json();
        setAgent(data.agent);
        setName(data.agent.name || "");
        setEmail(data.agent.email || "");
        setPhoneNumber(data.agent.phoneNumber || "");
        setAgentType(data.agent.agentType || "");
        setBarAssociationId(data.agent.barAssociationId || "");
      } else {
        // Redirect to login if unauthorized
        window.location.href = "/login";
      }
    } catch (error) {
      console.error("Error fetching agent profile:", error);
      window.location.href = "/login";
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProfileLoading(true);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Authentication required. Please login again.");
        window.location.href = "/login";
        return;
      }

  const response = await fetchWithAuth("/api/auth/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      // Update agent data in localStorage
      if (agent) {
        const updatedAgent = { ...agent, name };
        localStorage.setItem("agent", JSON.stringify(updatedAgent));
        setAgent(updatedAgent);
      }

      toast.success("Your name has been updated successfully.");
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to update profile. Please try again.";
      toast.error(errorMessage);
    } finally {
      setIsProfileLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("New password and confirm password do not match.");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters long.");
      return;
    }

    setIsPasswordLoading(true);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Authentication required. Please login again.");
        window.location.href = "/login";
        return;
      }

  const response = await fetchWithAuth("/api/agent/change-password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update password");
      }

      toast.success("Your password has been updated successfully.");
      // Clear password fields
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to update password. Please check your current password.";
      toast.error(errorMessage);
    } finally {
      setIsPasswordLoading(false);
    }
  };

  // Show loading state while user data is being loaded
  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-7xl py-10 space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-lg">Loading your settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl py-10 space-y-6">
      {/* Profile Settings */}
      <Card>
        <CardHeader className="flex flex-col space-y-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">Profile Settings</CardTitle>
            {agent?.agentType && (
              <Badge variant="secondary">
                {agent.agentType}
              </Badge>
            )}
          </div>
          <CardDescription>Manage your account information.</CardDescription>
        </CardHeader>
        <form onSubmit={handleProfileSave}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={agent?.email || ""}
                disabled
                className="bg-muted cursor-not-allowed"
              />
              <p className="text-sm text-muted-foreground">
                Email cannot be changed
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                required
              />
            </div>
          </CardContent>
          <CardContent className="pt-0 flex justify-end">
            <Button type="submit" className="mt-4" disabled={isProfileLoading}>
              {isProfileLoading ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Saving...
                </span>
              ) : (
                <span className="flex items-center">
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </span>
              )}
            </Button>
          </CardContent>
        </form>
      </Card>

      {/* Password Reset */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-2xl">
            <Shield className="mr-2 h-5 w-5" />
            Password Reset
          </CardTitle>
          <CardDescription>
            Update your password to keep your account secure.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handlePasswordReset}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter your new password"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Password must be at least 8 characters long
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your new password"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
          <CardContent className="pt-0 flex justify-end">
            <Button
              type="submit"
              disabled={
                isPasswordLoading ||
                !currentPassword ||
                !newPassword ||
                !confirmPassword
              }
              className="w-full sm:w-auto my-3"
            >
              {isPasswordLoading ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Updating Password...
                </span>
              ) : (
                <span className="flex items-center">
                  <Shield className="mr-2 h-4 w-4" />
                  Update Password
                </span>
              )}
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
