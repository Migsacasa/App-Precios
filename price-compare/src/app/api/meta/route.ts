export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    return NextResponse.json({ stores, products });
  } catch (e) {
    console.error("Failed to load metadata:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
