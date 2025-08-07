import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, otp, newPassword, confirmPassword } = body;

    // Validate required fields
    if (!email || !otp || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    // Validate password match
    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: "Passwords do not match" },
        { status: 400 }
      );
    }

    // Validate password strength
    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long" },
        { status: 400 }
      );
    }

    // Find agent by email
    const agent = await prisma.agent.findUnique({
      where: { email },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "No account found with this email address" },
        { status: 404 }
      );
    }

    // Verify OTP
    if (agent.resetOtp !== otp) {
      return NextResponse.json({ error: "Invalid OTP" }, { status: 400 });
    }

    if (!agent.otpExpiry || agent.otpExpiry < new Date()) {
      return NextResponse.json(
        { error: "OTP has expired. Please request a new one." },
        { status: 400 }
      );
    }

    if (!agent.isOtpVerified) {
      return NextResponse.json(
        { error: "Please verify OTP first" },
        { status: 400 }
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password and clear OTP fields
    await prisma.agent.update({
      where: { email },
      data: {
        password: hashedPassword,
        resetOtp: null,
        otpExpiry: null,
        isOtpVerified: false,
      },
    });

    return NextResponse.json({
      message: "Password reset successfully. You can now login with your new password.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
