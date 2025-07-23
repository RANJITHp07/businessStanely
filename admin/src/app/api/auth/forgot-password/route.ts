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

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
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
            )}.`,
          },
          { status: 429 }
        );
      }

      // Generate OTP
      const otpCode = generateOTP();
      const otpExpiry = new Date(Date.now() + 600000); // 10 minutes from now

      // Save OTP to database
      await prisma.user.update({
        where: { email },
        data: {
          resetOtp: otpCode,
          otpExpiry: otpExpiry,
          isOtpVerified: false,
        },
      });

      // Send OTP via email
      try {
        // Always try to send actual email using Nodemailer
        const emailResult = await sendOTPEmail({
          to: email,
          otp: otpCode,
          userName: user.username,
        });

        if (emailResult.success) {
          console.log(`OTP email sent successfully to ${email}`);
        } else {
          console.error("Failed to send OTP email:", emailResult.error);
          // In production, you might want to return an error here
          return NextResponse.json(
            { error: "Failed to send OTP email. Please try again later." },
            { status: 500 }
          );
        }
      } catch (emailError) {
        console.error("Failed to send OTP email:", emailError);
        return NextResponse.json(
          {
            error:
              "Failed to send OTP email. Please check your email configuration.",
          },
          { status: 500 }
        );
      }

      const remainingAttempts = otpRateLimiter.getRemainingAttempts(email);

      return NextResponse.json({
        message: "OTP sent to your email address.",
        remainingAttempts: remainingAttempts - 1, // Subtract 1 since we just used one
      });
    }

    // Action 2: Reset Password with OTP
    if (action === "reset-password") {
      if (!otp || !newPassword || !confirmPassword) {
        return NextResponse.json(
          { error: "OTP, new password, and confirm password are required" },
          { status: 400 }
        );
      }

      // Validate password length
      if (newPassword.length < 8) {
        return NextResponse.json(
          { error: "Password must be at least 8 characters long" },
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

      // Check if OTP is valid and not expired
      if (
        user.resetOtp !== otp ||
        !user.otpExpiry ||
        user.otpExpiry < new Date()
      ) {
        return NextResponse.json(
          { error: "Invalid or expired OTP" },
          { status: 400 }
        );
      }

      // Hash new password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update user password and clear OTP data
      await prisma.user.update({
        where: { email },
        data: {
          password: hashedPassword,
          resetOtp: null,
          otpExpiry: null,
          isOtpVerified: false,
        },
      });

      return NextResponse.json({
        message: "Password reset successfully",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}