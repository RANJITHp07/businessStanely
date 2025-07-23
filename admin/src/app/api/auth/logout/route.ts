import { NextResponse } from "next/server";

export async function POST() {
  try {
    // Create response
    const response = NextResponse.json({
      message: "Logged out successfully",
    });

    // Clear the auth cookie
    response.cookies.set({
      name: "auth-token",
      value: "",
      httpOnly: true,
      secure: false, // Set to false for localhost development
      sameSite: "lax",
      maxAge: 0, // Expire immediately
      path: "/", // Ensure cookie is cleared for all paths
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