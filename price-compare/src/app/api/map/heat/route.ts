import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManager, SecurityError } from "@/lib/security";

type HeatPoint = {
  storeId: string;
  customerCode: string;
  customerName: string;
  lat: number;
  lng: number;
  city: string | null;
  rating: "GOOD" | "REGULAR" | "BAD" | "NEEDS_REVIEW" | "NO_IMAGE";
  color: "green" | "yellow" | "red" | "orange" | "black";
  lastEvaluationAt: string | null;
};

function ratingColor(rating: "GOOD" | "REGULAR" | "BAD" | "NEEDS_REVIEW" | "NO_IMAGE") {
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
      orderBy: [{ city: "asc" }, { customerName: "asc" }],
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
      const hasPhoto = Boolean(latest?.photos[0]?.url);
      const rating: HeatPoint["rating"] = latest
        ? hasPhoto
          ? latest.aiOverallRating
          : "NO_IMAGE"
        : "NO_IMAGE";

      return {
        storeId: store.id,
        customerCode: store.customerCode,
        customerName: store.customerName,
        lat: store.lat,
        lng: store.lng,
        city: store.city,
        rating,
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
