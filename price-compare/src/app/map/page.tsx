import { prisma } from "@/lib/prisma";
import { requireManager } from "@/lib/security";
import { HeatMap } from "@/components/map/HeatMap";
import { getRecencyDays } from "@/lib/settings";

type RatingValue = "GOOD" | "REGULAR" | "BAD" | "NEEDS_REVIEW";

function ratingToColor(rating: RatingValue | null, isStale: boolean): "green" | "yellow" | "red" | "orange" | "black" {
  if (isStale) return "black";
  if (rating === "GOOD") return "green";
  if (rating === "REGULAR") return "yellow";
  if (rating === "BAD") return "red";
  if (rating === "NEEDS_REVIEW") return "orange";
  return "black";
}

export default async function MapPage({
  searchParams,
}: {
  searchParams?: Promise<{ from?: string; to?: string; city?: string }>;
}) {
  await requireManager();
  const params = await searchParams;

  const from = params?.from ? new Date(params.from) : undefined;
  const to = params?.to ? new Date(params.to) : undefined;
  const city = params?.city;

  const recencyDays = await getRecencyDays();
  const recencyCutoff = new Date();
  recencyCutoff.setDate(recencyCutoff.getDate() - recencyDays);

  let points: Array<{
    storeId: string;
    customerCode: string;
    name: string;
    lat: number;
    lng: number;
    city: string | null;
    zone: string | null;
    rating: RatingValue;
    color: "green" | "yellow" | "red" | "orange" | "black";
    isStale: boolean;
    score: number | null;
    confidence: number | null;
    lastEvaluationAt: string | null;
    findings: Array<{ type: string; detail: string; severity: string }>;
    recommendations: Array<{ priority: string; action: string; rationale?: string | null }>;
    segmentIndices: Array<{ segment: string; slot: number; priceIndex: number }>;
    photoUrls: string[];
    finalRating: string | null;
  }> = [];

  try {
    const stores = await prisma.store.findMany({
      where: {
        active: true,
        ...(city ? { city } : {}),
      },
      include: {
        evaluations: {
          where: {
            ...(from || to
              ? {
                  capturedAt: {
                    ...(from ? { gte: from } : {}),
                    ...(to ? { lte: to } : {}),
                  },
                }
              : {}),
          },
          orderBy: { capturedAt: "desc" },
          take: 1,
          include: {
            photos: true,
            segmentIndices: { orderBy: [{ segment: "asc" }, { slot: "asc" }] },
            aiFindings: true,
            aiRecommendations: true,
          },
        },
      },
    });

    points = stores.map((store) => {
      const latest = store.evaluations[0];
      const isStale = latest ? latest.capturedAt < recencyCutoff : true;
      const rating = (latest?.finalRating ?? latest?.aiRating ?? "NEEDS_REVIEW") as RatingValue;

      return {
        storeId: store.id,
        customerCode: store.customerCode,
        name: store.name,
        lat: Number(store.lat),
        lng: Number(store.lng),
        city: store.city,
        zone: store.zone,
        rating,
        color: ratingToColor(rating, isStale),
        isStale,
        score: latest?.aiScore ?? null,
        confidence: latest?.aiConfidence ?? null,
        lastEvaluationAt: latest?.capturedAt?.toISOString() ?? null,
        findings: latest?.aiFindings?.map((f) => ({ type: f.type, detail: f.detail, severity: f.severity })) ?? [],
        recommendations: latest?.aiRecommendations?.map((r) => ({ priority: r.priority, action: r.action, rationale: r.rationale })) ?? [],
        segmentIndices: latest?.segmentIndices?.map((s) => ({ segment: s.segment, slot: s.slot, priceIndex: Number(s.priceIndex ?? 0) })) ?? [],
        photoUrls: latest?.photos?.map((p) => p.url) ?? [],
        finalRating: latest?.finalRating ?? null,
      };
    });
  } catch (error) {
    console.error("Failed to load map data:", error);
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Store Positioning Map</h1>
      <p className="text-sm text-foreground/60">
        Recency window: {recencyDays} days. Black markers indicate stale or unevaluated stores.
      </p>
      <div className="rounded-xl border overflow-hidden">
        <HeatMap points={points} />
      </div>
    </div>
  );
}
