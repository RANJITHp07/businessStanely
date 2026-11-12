import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { buildArchivedAgentEmail } from "@/lib/agentEmail";
import { sendAgentCredentialsUpdatedEmail } from "@/lib/email";

// Same minimum the agent app enforces on its own change-password screen.
const MIN_PASSWORD_LENGTH = 6;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * PATCH: an admin changes an agent's login email and/or password.
 * Body: { email?: string, password?: string, notifyAgent?: boolean }
 *
 * Either change signs the agent out (clears currentSessionToken), so they
 * must log in again with the new details. With notifyAgent (default true)
 * the agent is emailed the new details at their new login address.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const currentAdmin = await getCurrentAdmin(req);
    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const rawEmail = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const notifyAgent = body.notifyAgent !== false;

    const agent = await prisma.agent.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, status: true },
    });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    if (agent.status !== "active") {
      return NextResponse.json(
        { error: "Only active agents can have their login details changed." },
        { status: 400 },
      );
    }

    const newEmail = rawEmail.toLowerCase();
    const emailChanged = !!newEmail && newEmail !== agent.email.toLowerCase();
    const passwordChanged = password.length > 0;

    if (!emailChanged && !passwordChanged) {
      return NextResponse.json(
        { error: "Enter a new email or a new password." },
        { status: 400 },
      );
    }

    if (emailChanged && !EMAIL_PATTERN.test(newEmail)) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 },
      );
    }

    if (passwordChanged && password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        {
          error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
        },
        { status: 400 },
      );
    }

    if (emailChanged) {
      const conflict = await prisma.agent.findFirst({
        where: {
          email: { equals: newEmail, mode: "insensitive" },
          id: { not: id },
        },
        select: { id: true, email: true, status: true },
      });

      if (conflict) {
        if (conflict.status !== "inactive") {
          return NextResponse.json(
            { error: "Another agent already uses this email." },
            { status: 400 },
          );
        }
        // An inactive agent still holding the address releases it, as the
        // agent edit form does.
        await prisma.agent.update({
          where: { id: conflict.id },
          data: { email: buildArchivedAgentEmail(conflict.email, conflict.id) },
        });
      }
    }

    await prisma.agent.update({
      where: { id },
      data: {
        ...(emailChanged ? { email: newEmail } : {}),
        ...(passwordChanged
          ? {
              password: await bcrypt.hash(password, 12),
              // Drop any pending forgot-password OTP for the old password.
              resetOtp: null,
              otpExpiry: null,
              isOtpVerified: false,
            }
          : {}),
        // Sign the agent out everywhere; they log in again with the new details.
        currentSessionToken: null,
      },
    });

    let emailSent = false;
    if (notifyAgent) {
      const result = await sendAgentCredentialsUpdatedEmail({
        to: emailChanged ? newEmail : agent.email,
        userName: agent.name,
        password: passwordChanged ? password : undefined,
        previousEmail: emailChanged ? agent.email : undefined,
      });
      emailSent = result.success;
    }

    return NextResponse.json({
      success: true,
      email: emailChanged ? newEmail : agent.email,
      emailChanged,
      passwordChanged,
      notified: notifyAgent ? emailSent : false,
    });
  } catch (error) {
    console.error("Error updating agent credentials:", error);
    return NextResponse.json(
      { error: "Failed to update login details" },
      { status: 500 },
    );
  }
}
