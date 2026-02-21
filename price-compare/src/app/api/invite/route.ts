import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";

// Invitation model has been removed from the schema.
// This route is kept as a stub to avoid 404s on existing clients.

export async function GET(req: Request) {
  return jsonError(req, { code: "GONE", message: "Invitations are no longer supported" }, 410);
}

export async function POST(req: Request) {
  return jsonError(req, { code: "GONE", message: "Invitations are no longer supported" }, 410);
}
