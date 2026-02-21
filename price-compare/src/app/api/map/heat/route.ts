import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManager, SecurityError } from "@/lib/security";

type HeatPoint = {
  storeId: string;
  customerCode: string;
  name: string;
  lat: number;
  lng: number;
  city: string | null;
  rating: "GOOD" | "REGULAR" | "BAD" | "NEEDS_REVIEW";
  color: "green" | "yellow" | "red" | "orange" | "black";
  lastEvaluationAt: string | null;
};

function ratingColor(rating: "GOOD" | "REGULAR" | "BAD" | "NEEDS_REVIEW" | null) {
  if (rating === "GOOD") return "green" as const;
  if (rating === "REGULAR") return "yellow" as const;
  if (rating === "BAD") return "red" as const;
  if (rating === "NEEDS_REVIEW") return "orange" as const;
  return "black" as const;
}

export async function GET(req: Request) {
  try {
    await requireManager();

    const url = new URL(req.url);
    const city = url.searchParams.get("city") || undefined;
    const stores = await prisma.store.findMany({
      where: {
        ...(city ? { city } : {}),
      },
      orderBy: [{ city: "asc" }, { name: "asc" }],
      include: {
        evaluations: {
          orderBy: { capturedAt: "desc" },
          take: 1,
          include: { photos: { take: 1 } },
        },
      },
    });

    const points: HeatPoint[] = stores.map((store) => {
      const latest = store.evaluations[0];
      const rating = latest?.finalRating ?? latest?.aiRating ?? null;

      return {
        storeId: store.id,
        customerCode: store.customerCode,
        name: store.name,
        lat: Number(store.lat),
        lng: Number(store.lng),
        city: store.city,
        rating: rating ?? "NEEDS_REVIEW",
        color: ratingColor(rating),
        lastEvaluationAt: latest?.capturedAt?.toISOString() ?? null,
      };
    });

    return NextResponse.json({ points });
  } catch (error) {
    if (error instanceof SecurityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
