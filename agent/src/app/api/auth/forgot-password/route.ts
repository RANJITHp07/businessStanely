import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { sendOTPEmail } from "@/lib/email";
import { otpRateLimiter, formatRemainingTime } from "@/lib/rateLimiter";

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, otp, newPassword, confirmPassword, action } = body;

    // Validate email
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
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

    // Action 1: Send OTP
    if (action === "send-otp") {
      // Check rate limiting
      if (!otpRateLimiter.isAllowed(email)) {
        const remainingTime = otpRateLimiter.getRemainingTime(email);
        return NextResponse.json(
          {
            error: `Too many OTP requests. Please try again in ${formatRemainingTime(
              remainingTime
            )}`,
          },
          { status: 429 }
        );
      }

      // Generate OTP
      const newOtp = generateOTP();
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Update agent with OTP
      await prisma.agent.update({
        where: { email },
        data: {
          resetOtp: newOtp,
          otpExpiry,
          isOtpVerified: false,
        },
      });

      // Send OTP email
      try {
        await sendOTPEmail({ to: email, userName: agent.name, otp: newOtp });
        return NextResponse.json({
          message: "OTP sent successfully. Please check your email.",
        });
      } catch (emailError) {
        console.error("Failed to send OTP email:", emailError);
        return NextResponse.json(
          { error: "Failed to send OTP. Please try again." },
          { status: 500 }
        );
      }
    }

    // Action 2: Verify OTP
    if (action === "verify-otp") {
      if (!otp) {
        return NextResponse.json({ error: "OTP is required" }, { status: 400 });
      }

      // Check if OTP matches and is not expired
      if (agent.resetOtp !== otp) {
        return NextResponse.json({ error: "Invalid OTP" }, { status: 400 });
      }

      if (!agent.otpExpiry || agent.otpExpiry < new Date()) {
        return NextResponse.json(
          { error: "OTP has expired. Please request a new one." },
          { status: 400 }
        );
      }

      // Mark OTP as verified
      await prisma.agent.update({
        where: { email },
        data: { isOtpVerified: true },
      });

      return NextResponse.json({ message: "OTP verified successfully" });
    }

    // Action 3: Reset Password
    if (action === "reset-password") {
      if (!otp || !newPassword || !confirmPassword) {
        return NextResponse.json(
          { error: "OTP, new password, and confirm password are required" },
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

      // Check if OTP is verified and not expired
      if (!agent.isOtpVerified) {
        return NextResponse.json(
          { error: "Please verify OTP first" },
          { status: 400 }
        );
      }

      if (agent.resetOtp !== otp) {
        return NextResponse.json({ error: "Invalid OTP" }, { status: 400 });
      }

      if (!agent.otpExpiry || agent.otpExpiry < new Date()) {
        return NextResponse.json(
          { error: "OTP has expired. Please request a new one." },
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

      // Reset rate limiter
      otpRateLimiter.reset(email);

      return NextResponse.json({
        message: "Password reset successfully. You can now login with your new password.",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Forgot password error:", error);
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
