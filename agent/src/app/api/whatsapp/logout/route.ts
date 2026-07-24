import { NextResponse } from "next/server";

export async function POST() {
  // The WhatsApp session is shared by every agent. Only the admin application
  // may disconnect it; allowing one agent to log out would interrupt everyone.
  return NextResponse.json(
    { error: "Only an administrator can disconnect the WhatsApp session." },
    { status: 403 },
  );
}
