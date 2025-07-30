"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, LogIn } from "lucide-react";
import logo from "../../../public/Logo.jpg";

export default function SignupPageUIOnly() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#e3f2fd] py-12 px-4 sm:px-6 lg:px-8 relative">
      <Card className="mt-[150px] md:mt-[0px] w-full max-w-md bg-white">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <Image src={logo} alt="logo" className="h-[50px] w-[220px]" />
          </div>
          <CardTitle className="text-2xl font-bold text-black">Sign Up</CardTitle>
          <CardDescription className="text-black">
            Create your account below
          </CardDescription>
        </CardHeader>
        <form>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-black" htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter your name"
                className="text-black placeholder:text-black"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-black" htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                className="text-black placeholder:text-black"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-black">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  className="text-black placeholder:text-black"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-black"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-black">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  className="text-black placeholder:text-black"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-black"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Button type="submit" className="w-full">
              <span className="flex items-center">
                <LogIn className="mr-2 h-4 w-4" />
                Sign Up
              </span>
            </Button>
            <div className="text-center space-y-2">
              <Link
                href="/login"
                className="text-sm text-blue-600 hover:text-blue-500 hover:underline"
              >
                Already have an account? Sign In
              </Link>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
