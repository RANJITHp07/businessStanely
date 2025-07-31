import { NextResponse } from "next/server";

export async function POST() {
  try {
    // Create response
    const response = NextResponse.json({
      message: "Logged out successfully",
    });

    // Clear the auth cookie
    response.cookies.set({
      name: "agent-auth-token",
      value: "",
      httpOnly: true,
      secure: process.env.NEXT_PUBLIC_VERCEL_ENV === "production",
      sameSite: "lax",
      maxAge: 0, // Immediately expire the cookie
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
