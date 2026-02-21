import { prisma } from "@/lib/prisma";
import { requireManager } from "@/lib/security";
import { HeatMap } from "@/components/map/HeatMap";
import { getRecencyDays } from "@/lib/settings";

type AiOverallRating = "GOOD" | "REGULAR" | "BAD" | "NEEDS_REVIEW" | "NO_IMAGE";

function ratingToColor(rating: AiOverallRating, isStale: boolean): "green" | "yellow" | "red" | "orange" | "black" {
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
    customerName: string;
    lat: number;
    lng: number;
    city: string | null;
    zone: string | null;
    rating: AiOverallRating;
    color: "green" | "yellow" | "red" | "orange" | "black";
    isStale: boolean;
    score: number | null;
    confidence: number | null;
    lastEvaluationAt: string | null;
    summary: string | null;
    whyBullets: string[];
    evidence: Array<{ type: string; detail: string; severity: string }>;
    recommendations: Array<{ priority: string; action: string; rationale?: string }>;
    segmentInputs: Array<{ segment: string; slot: number; priceIndex: number }>;
    photoUrls: string[];
    overrideRating: string | null;
  }> = [];

  try {
    const stores = await prisma.store.findMany({
      where: {
        isActive: true,
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
            segmentInputs: { orderBy: [{ segment: "asc" }, { slot: "asc" }] },
          },
        },
      },
    });

    points = stores.map((store) => {
      const latest = store.evaluations[0];
      const hasPhoto = latest?.photos?.length > 0;
      const isStale = latest ? latest.capturedAt < recencyCutoff : true;
      const rating: AiOverallRating = latest
        ? hasPhoto
          ? ((latest.overrideRating ?? latest.aiOverallRating) as AiOverallRating)
          : "NO_IMAGE"
        : "NO_IMAGE";

      return {
        storeId: store.id,
        customerCode: store.customerCode,
        customerName: store.customerName,
        lat: store.lat,
        lng: store.lng,
        city: store.city,
        zone: store.zone,
        rating,
        color: ratingToColor(rating, isStale),
        isStale,
        score: latest?.aiScore ?? null,
        confidence: latest?.aiConfidence ?? null,
        lastEvaluationAt: latest?.capturedAt?.toISOString() ?? null,
        summary: latest?.aiSummary ?? null,
        whyBullets: (latest?.aiWhyBullets as string[] | null) ?? [],
        evidence: (latest?.aiEvidence as Array<{ type: string; detail: string; severity: string }> | null) ?? [],
        recommendations: (latest?.aiRecommendations as Array<{ priority: string; action: string; rationale?: string }> | null) ?? [],
        segmentInputs: latest?.segmentInputs?.map((s) => ({ segment: s.segment, slot: s.slot, priceIndex: Number(s.priceIndex) })) ?? [],
        photoUrls: latest?.photos?.map((p) => p.url) ?? [],
        overrideRating: latest?.overrideRating ?? null,
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
