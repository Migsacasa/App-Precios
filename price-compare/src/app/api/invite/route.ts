import { NextResponse } from "next/server";

// Invitation model has been removed from the schema.
// This route is kept as a stub to avoid 404s on existing clients.

export async function GET() {
  return NextResponse.json({ error: "Invitations are no longer supported" }, { status: 410 });
}

export async function POST() {
  return NextResponse.json({ error: "Invitations are no longer supported" }, { status: 410 });
}
