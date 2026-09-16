import { NextRequest, NextResponse } from "next/server";
import { getSignedDownloadUrl } from "@/lib/aws";
import { getCurrentAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Redirects to a short-lived signed URL for any attachment key in the bucket.
 *
 * The existing /uploads/[filename] route only handles keys shaped
 * `uploads/<name>`. Portal attachments are nested per account
 * (`uploads/portal/<accountId>/<name>`), so they need a route that takes the
 * whole key. Authenticated, because it can reach any object in the bucket.
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const key = new URL(req.url).searchParams.get("key");
    if (!key) {
      return NextResponse.json({ error: "Missing key" }, { status: 400 });
    }

    // Keep the reach inside the uploads prefix, and refuse traversal.
    if (!key.startsWith("uploads/") || key.includes("..")) {
      return NextResponse.json({ error: "Invalid key" }, { status: 400 });
    }

    return NextResponse.redirect(await getSignedDownloadUrl(key));
  } catch (error) {
    console.error("Failed to serve attachment:", error);
    return NextResponse.json(
      { error: "Failed to open attachment" },
      { status: 500 },
    );
  }
}
