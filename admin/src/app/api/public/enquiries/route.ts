import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { enquiryRateLimiter, formatRemainingTime } from "@/lib/rateLimiter";

/**
 * Public intake for service requests submitted on the businessPlus website.
 *
 * This is the one route in the app that accepts writes with no authentication,
 * because the sender is an anonymous visitor on a marketing site. Three things
 * follow from that and none of them are optional:
 *
 *  - Rows land in Enquiry, never straight into Prospect. An agent reviews each
 *    one and converts it, so unvetted input cannot walk into the sales pipeline.
 *  - Only the fields below are read off the body. Anything else a caller sends
 *    (status, convertedProspectId, deletedAt) is ignored rather than spread in.
 *  - Submissions are rate limited per IP and capped in length.
 *
 * The website is served from a different origin, so CORS is answered here.
 */

/**
 * Origins allowed to post enquiries. Set ENQUIRY_ALLOWED_ORIGINS to a
 * comma-separated list in production ("https://businessplus.example").
 * Falls back to localhost so the two dev servers can talk to each other.
 */
function allowedOrigins(): string[] {
  const configured = process.env.ENQUIRY_ALLOWED_ORIGINS;
  if (configured) {
    return configured
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
  }
  return ["http://localhost:3000", "http://localhost:3001"];
}

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  // Echo the origin only when it is on the list; an unknown origin gets no
  // allow header at all, so the browser blocks the response.
  if (origin && allowedOrigins().includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin")),
  });
}

/** Field caps, so a single submission cannot write an unbounded document. */
const MAX_LENGTHS = {
  name: 200,
  email: 320,
  phone: 40,
  company: 200,
  notes: 5000,
  payment: 40,
  service: 200,
} as const;

const MAX_SERVICES = 30;

/** Trim, cap, and turn blank strings into null so the DB holds one empty value. */
function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

/**
 * Deliberately permissive: this only rejects input that is obviously not an
 * address. Anything stricter starts dropping real enquiries, which costs more
 * than a junk row an agent can mark as spam.
 */
function isEmailShaped(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  try {
    const ip = clientIp(req);
    if (!enquiryRateLimiter.isAllowed(ip)) {
      const wait = formatRemainingTime(enquiryRateLimiter.getRemainingTime(ip));
      return NextResponse.json(
        { error: `Too many requests. Please try again in ${wait}.` },
        { status: 429, headers },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400, headers },
      );
    }

    const input = (body ?? {}) as Record<string, unknown>;

    const name = clean(input.name, MAX_LENGTHS.name);
    const email = clean(input.email, MAX_LENGTHS.email);

    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400, headers },
      );
    }
    if (!email || !isEmailShaped(email)) {
      return NextResponse.json(
        { error: "A valid email address is required" },
        { status: 400, headers },
      );
    }

    const services = Array.isArray(input.services)
      ? input.services
          .map((s) => clean(s, MAX_LENGTHS.service))
          .filter((s): s is string => Boolean(s))
          .slice(0, MAX_SERVICES)
      : [];

    const enquiry = await prisma.enquiry.create({
      data: {
        name,
        email,
        phone: clean(input.phone, MAX_LENGTHS.phone),
        company: clean(input.company, MAX_LENGTHS.company),
        services,
        payment: clean(input.payment, MAX_LENGTHS.payment),
        notes: clean(input.notes, MAX_LENGTHS.notes),
        source: "service-request",
        status: "New",
        ipAddress: ip,
        userAgent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
      },
      select: { id: true },
    });

    // The website only needs to know it worked; nothing about the admin side
    // is echoed back to an anonymous caller.
    return NextResponse.json(
      { ok: true, id: enquiry.id },
      { status: 201, headers },
    );
  } catch (error) {
    console.error("Failed to record enquiry:", error);
    return NextResponse.json(
      { error: "Failed to submit enquiry" },
      { status: 500, headers },
    );
  }
}
