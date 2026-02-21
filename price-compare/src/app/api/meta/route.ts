export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { jsonError, withRequestIdHeader } from "@/lib/api-response";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return jsonError(req, { code: "UNAUTHORIZED", message: "Unauthorized" }, 401);
  }

  try {
    const [stores, products] = await Promise.all([
      prisma.store.findMany({
        where: { active: true },
        orderBy: [{ city: "asc" }, { name: "asc" }],
        select: {
          id: true,
          customerCode: true,
          name: true,
          city: true,
          lat: true,
          lng: true,
        },
      }),
      prisma.product.findMany({
        where: { active: true },
        orderBy: [{ segment: "asc" }, { name: "asc" }],
      }),
    ]);

    return NextResponse.json(
      { stores, products },
      { headers: withRequestIdHeader(req) },
    );
  } catch (e) {
    console.error("Failed to load metadata:", e);
    return jsonError(req, { code: "INTERNAL_ERROR", message: "Internal server error" }, 500);
  }
}
