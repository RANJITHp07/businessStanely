'use client'

import React, { useState } from "react";
import { Eye, EyeOff, Save, Shield } from "lucide-react";

// Mock user data for display
const mockUser = {
  id: "1",
  username: "admin_user",
  email: "admin@example.com",
  adminType: "owner"
};

export default function AdminSettingsPage() {
  // Only UI state for password visibility
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <div className="container mx-auto p-[20px] max-w-7xl  space-y-6">
      {/* Profile Settings */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex flex-col space-y-2 p-6 pb-0">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl text-black font-semibold leading-none tracking-tight">Profile Settings</h3>
            {mockUser?.adminType && (
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                mockUser.adminType === "owner" 
                  ? "bg-red-100 text-red-800 border border-red-200" 
                  : "bg-gray-100 text-gray-800 border border-gray-200"
              }`}>
                {mockUser.adminType === "owner" ? "Owner" : "Admin"}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600">Manage your account information.</p>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm text-black  font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={mockUser?.email || ""}
              disabled
              className="flex h-10 w-full text-black rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <p className="text-sm text-gray-600">
              Email cannot be changed
            </p>
          </div>
          <div className="space-y-2">
            <label htmlFor="username" className="text-sm text-black font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Username
            </label>
            <input
              id="username"
              defaultValue={mockUser.username}
              placeholder="Enter your username"
              required
              className="flex h-10 w-full rounded-md text-black border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>
        
        <div className="pt-0 flex justify-end p-6">
          <button 
            type="button"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-gray-900 text-gray-50 hover:bg-gray-900/90 h-10 px-4 py-2 mt-4"
          >
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </button>
        </div>
      </div>

      {/* Password Reset */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-6 pb-0">
          <h3 className="flex items-center text-black text-2xl font-semibold leading-none tracking-tight">
            <Shield className="mr-2 h-5 w-5" />
            Password Reset
          </h3>
          <p className="text-sm text-gray-600 mt-2">
            Update your password to keep your account secure.
          </p>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <label htmlFor="current-password" className="text-sm text-black font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Current Password
            </label>
            <div className="relative">
              <input
                id="current-password"
                type={showCurrentPassword ? "text" : "password"}
                placeholder="Enter your current password"
                required
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-gray-100 hover:text-gray-900 absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              >
                {showCurrentPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>


          <div className="space-y-2">
            <label htmlFor="new-password" className="text-sm text-black font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              New Password
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={showNewPassword ? "text" : "password"}
                placeholder="Enter your new password"
                required
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-gray-100 hover:text-gray-900 absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              >
                {showNewPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-sm text-gray-600">
              Password must be at least 8 characters long
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="confirm-password" className="text-sm text-black font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm your new password"
                required
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-gray-100 hover:text-gray-900 absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
        
        <div className="pt-0 flex justify-end p-6">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-gray-900 text-gray-50 hover:bg-gray-900/90 h-10 px-4 py-2 w-full sm:w-auto my-3"
          >
            <Shield className="mr-2 h-4 w-4" />
            Update Password
          </button>
        </div>
      </div>
    </div>
  );
}