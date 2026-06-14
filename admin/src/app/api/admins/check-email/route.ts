import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { error: "Email parameter is required" },
        { status: 400 }
      );
    }

    // Always check emails in lowercase for case-insensitive uniqueness
    const existingAdmin = await prisma.user.findFirst({
      where: {
        email: { equals: email.toLowerCase(), mode: "insensitive" },
        status: "active",
      },
      select: { id: true },
    });

    return NextResponse.json({ exists: !!existingAdmin });
  } catch (error) {
    console.error("Error checking email:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
