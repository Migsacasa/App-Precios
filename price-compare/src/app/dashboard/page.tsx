import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { CategoryBar } from "@/components/dashboard/CategoryBar";
import { RatingMixChart } from "@/components/dashboard/rating-mix-chart";
import { ConfidenceBucketsChart } from "@/components/dashboard/confidence-buckets-chart";
import { SubScoreChart } from "@/components/dashboard/subscore-chart";
import { getScoringThresholds } from "@/lib/settings";

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getSubScores(outputJson: unknown): { visibility: number; shelfShare: number; placement: number; availability: number } | null {
  if (!outputJson || typeof outputJson !== "object") return null;
  const subScores = (outputJson as { subScores?: unknown }).subScores;
  if (!subScores || typeof subScores !== "object") return null;

  const raw = subScores as Record<string, unknown>;
  const visibility = typeof raw.visibility === "number" ? raw.visibility : null;
  const shelfShare = typeof raw.shelfShare === "number" ? raw.shelfShare : null;
  const placement = typeof raw.placement === "number" ? raw.placement : null;
  const availability = typeof raw.availability === "number" ? raw.availability : null;

  if (visibility == null || shelfShare == null || placement == null || availability == null) return null;
  return { visibility, shelfShare, placement, availability };
}

function ratingBadge(rating: string) {
  const map: Record<string, string> = {
    GOOD: "bg-green-100 text-green-800",
    REGULAR: "bg-yellow-100 text-yellow-800",
    BAD: "bg-red-100 text-red-800",
    NEEDS_REVIEW: "bg-orange-100 text-orange-800",
  };
  return map[rating] ?? "bg-gray-100 text-gray-800";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ from?: string; to?: string; city?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (!session.user.role || !["MANAGER", "ADMIN"].includes(session.user.role)) {
    redirect("/observations");
  }

  const params = await searchParams;
  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 30);

  const from = params?.from ? new Date(params.from) : defaultFrom;
  const to = params?.to ? new Date(params.to) : now;
  const city = params?.city;

  const thresholds = await getScoringThresholds();

  let stores: Awaited<ReturnType<typeof prisma.store.findMany>> = [];
  let evaluations: Awaited<ReturnType<typeof prisma.evaluation.findMany<{
    include: {
      store: true;
      photos: true;
      segmentIndices: true;
      aiFindings: true;
      aiRecommendations: true;
      aiEvaluation: true;
    };
  }>>> = [];

  try {
    [stores, evaluations] = await Promise.all([
      prisma.store.findMany({ where: city ? { city } : undefined }),
      prisma.evaluation.findMany({
        where: {
          capturedAt: { gte: from, lte: to },
          ...(city ? { store: { city } } : {}),
        },
        include: {
          store: true,
          photos: true,
          segmentIndices: true,
          aiFindings: true,
          aiRecommendations: true,
          aiEvaluation: true,
        },
        orderBy: { capturedAt: "desc" },
        take: 5000,
      }),
    ]);
  } catch (e) {
    console.error("Failed to load dashboard data:", e);
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <h1 className="text-xl font-semibold">Manager Dashboard</h1>
        <div className="p-4 text-sm text-red-600 bg-red-50 rounded">
          Could not load dashboard data. Please try again later.
        </div>
      </div>
    );
  }

  const latestByStore = new Map<string, (typeof evaluations)[number]>();
  for (const evaluation of evaluations) {
    if (!latestByStore.has(evaluation.storeId)) {
      latestByStore.set(evaluation.storeId, evaluation);
    }
  }

  const total = evaluations.length;
  const good = evaluations.filter((item) => (item.finalRating ?? item.aiRating) === "GOOD").length;
  const regular = evaluations.filter((item) => (item.finalRating ?? item.aiRating) === "REGULAR").length;
  const bad = evaluations.filter((item) => (item.finalRating ?? item.aiRating) === "BAD").length;
  const needsReview = evaluations.filter((item) => (item.finalRating ?? item.aiRating) === "NEEDS_REVIEW").length;

  const coverage = stores.length ? (latestByStore.size / stores.length) * 100 : 0;

  // 7-day coverage
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const storesEval7d = new Set(evaluations.filter((e) => e.capturedAt >= sevenDaysAgo).map((e) => e.storeId));
  const coverage7d = stores.length ? (storesEval7d.size / stores.length) * 100 : 0;

  // Average score
  const scored = evaluations.filter((e) => e.aiScore != null);
  const avgScore = scored.length ? Math.round(scored.reduce((s, e) => s + (e.aiScore ?? 0), 0) / scored.length) : null;

  const trendMap = new Map<string, { good: number; total: number }>();
  for (const evaluation of evaluations) {
    const key = dateKey(evaluation.capturedAt);
    const current = trendMap.get(key) ?? { good: 0, total: 0 };
    current.total += 1;
    if ((evaluation.finalRating ?? evaluation.aiRating) === "GOOD") current.good += 1;
    trendMap.set(key, current);
  }

  const trend = Array.from(trendMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({ date, index: value.total ? Number(((value.good / value.total) * 100).toFixed(1)) : 0 }));

  const segmentScores = new Map<string, number[]>();
  for (const evaluation of evaluations) {
    for (const input of evaluation.segmentIndices) {
      const key = input.segment;
      const values = segmentScores.get(key) ?? [];
      values.push(Number(input.priceIndex));
      segmentScores.set(key, values);
    }
  }

  const byCategory = Array.from(segmentScores.entries()).map(([category, values]) => ({
    category,
    index: values.length ? Number((values.reduce((acc, value) => acc + value, 0) / values.length).toFixed(1)) : 0,
  }));

  const ratingMix = [
    { rating: "GOOD", count: good },
    { rating: "REGULAR", count: regular },
    { rating: "BAD", count: bad },
    { rating: "NEEDS_REVIEW", count: needsReview },
  ];

  const confidences = evaluations
    .map((evaluation) => evaluation.aiConfidence)
    .filter((confidence): confidence is number => confidence != null);

  const confidenceBuckets = [
    {
      bucket: `<${Math.round(thresholds.needsReviewConfidence * 100)}%`,
      count: confidences.filter((c) => c < thresholds.needsReviewConfidence).length,
    },
    {
      bucket: `${Math.round(thresholds.needsReviewConfidence * 100)}-${Math.round(thresholds.goodConfidence * 100)}%`,
      count: confidences.filter((c) => c >= thresholds.needsReviewConfidence && c < thresholds.goodConfidence).length,
    },
    {
      bucket: `>=${Math.round(thresholds.goodConfidence * 100)}%`,
      count: confidences.filter((c) => c >= thresholds.goodConfidence).length,
    },
  ];

  const subScoreSamples = evaluations
    .map((evaluation) => getSubScores(evaluation.aiEvaluation?.outputJson))
    .filter((item): item is { visibility: number; shelfShare: number; placement: number; availability: number } => item != null);

  const avgSubScores = subScoreSamples.length
    ? {
        visibility: Number((subScoreSamples.reduce((acc, value) => acc + value.visibility, 0) / subScoreSamples.length).toFixed(1)),
        shelfShare: Number((subScoreSamples.reduce((acc, value) => acc + value.shelfShare, 0) / subScoreSamples.length).toFixed(1)),
        placement: Number((subScoreSamples.reduce((acc, value) => acc + value.placement, 0) / subScoreSamples.length).toFixed(1)),
        availability: Number((subScoreSamples.reduce((acc, value) => acc + value.availability, 0) / subScoreSamples.length).toFixed(1)),
      }
    : null;

  const subScoreData = avgSubScores
    ? [
        { metric: "Visibility", score: avgSubScores.visibility },
        { metric: "Shelf Share", score: avgSubScores.shelfShare },
        { metric: "Placement", score: avgSubScores.placement },
        { metric: "Availability", score: avgSubScores.availability },
      ]
    : [];

  const scoredByThreshold = evaluations.filter((evaluation) => evaluation.aiScore != null);
  const aboveGoodScoreThreshold = scoredByThreshold.filter((evaluation) => (evaluation.aiScore ?? 0) >= thresholds.goodScore).length;
  const belowBadScoreThreshold = scoredByThreshold.filter((evaluation) => (evaluation.aiScore ?? 0) < thresholds.badScore).length;
  const belowReviewConfidence = confidences.filter((confidence) => confidence < thresholds.needsReviewConfidence).length;
  const highConfidence = confidences.filter((confidence) => confidence >= thresholds.goodConfidence).length;

  const weakestSubScore = subScoreData.length
    ? [...subScoreData].sort((a, b) => a.score - b.score)[0]
    : null;

  const strongestSubScore = subScoreData.length
    ? [...subScoreData].sort((a, b) => b.score - a.score)[0]
    : null;

  const aiSummary = [
    `Coverage is ${coverage.toFixed(0)}% (${latestByStore.size}/${stores.length} stores), with ${coverage7d.toFixed(0)}% visited in the last 7 days.`,
    `${total ? ((good / total) * 100).toFixed(1) : "0.0"}% GOOD and ${total ? ((bad / total) * 100).toFixed(1) : "0.0"}% BAD indicate current execution quality.`,
    `Score thresholds: ${aboveGoodScoreThreshold}/${scoredByThreshold.length} evaluations are >= ${thresholds.goodScore}, while ${belowBadScoreThreshold}/${scoredByThreshold.length} are < ${thresholds.badScore}.`,
    `Confidence thresholds: ${highConfidence}/${confidences.length} are >= ${(thresholds.goodConfidence * 100).toFixed(0)}%, and ${belowReviewConfidence}/${confidences.length} are below ${(thresholds.needsReviewConfidence * 100).toFixed(0)}% (higher review risk).`,
    weakestSubScore && strongestSubScore
      ? `Visibility mix: strongest area is ${strongestSubScore.metric} (${strongestSubScore.score}/25) and weakest is ${weakestSubScore.metric} (${weakestSubScore.score}/25).`
      : "Visibility mix is not available yet because AI sub-score data is missing.",
  ];

  // Drivers analysis: which evidence types co-occur with BAD ratings
  const driverCounts = new Map<string, number>();
  const badEvals = evaluations.filter((e) => (e.finalRating ?? e.aiRating) === "BAD");
  for (const e of badEvals) {
    for (const finding of e.aiFindings) {
      driverCounts.set(finding.type, (driverCounts.get(finding.type) ?? 0) + 1);
    }
  }
  const drivers = Array.from(driverCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => ({ type, count, pct: badEvals.length ? Math.round((count / badEvals.length) * 100) : 0 }));

  // Top 10 action items from recommendations
  const actionItems: Array<{ store: string; action: string; priority: string }> = [];
  for (const e of evaluations) {
    for (const r of e.aiRecommendations) {
      if (actionItems.length >= 10) break;
      actionItems.push({
        store: `${e.store.customerCode} · ${e.store.name}`,
        action: r.action,
        priority: r.priority ?? "P2",
      });
    }
    if (actionItems.length >= 10) break;
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">Manager Dashboard</h1>
      <p className="text-sm text-foreground/60">Retail superiority execution overview</p>

      {total === 0 && (
        <div className="border rounded-lg p-8 text-center text-foreground/60">
          <p className="text-lg font-medium mb-1">No evaluations yet</p>
          <p className="text-sm">Field evaluators need to capture store visits before analytics appear here.</p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="border rounded-lg p-4">
          <p className="text-xs opacity-80">Evaluations</p>
          <p className="text-2xl font-semibold">{total}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-xs opacity-80">Avg Score</p>
          <p className="text-2xl font-semibold">{avgScore ?? "—"}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-xs text-green-600">% GOOD</p>
          <p className="text-2xl font-semibold text-green-600">{total ? ((good / total) * 100).toFixed(1) : "0.0"}%</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-xs text-red-600">% BAD</p>
          <p className="text-2xl font-semibold text-red-600">{total ? ((bad / total) * 100).toFixed(1) : "0.0"}%</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-xs text-orange-600">Needs Review</p>
          <p className="text-2xl font-semibold text-orange-600">{needsReview}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-xs opacity-80">Coverage</p>
          <p className="text-2xl font-semibold">{coverage.toFixed(0)}%</p>
          <p className="text-xs opacity-60">{latestByStore.size}/{stores.length} stores · 7d: {coverage7d.toFixed(0)}%</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <TrendChart data={trend} />
        <CategoryBar data={byCategory} />
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <RatingMixChart data={ratingMix} />
        <ConfidenceBucketsChart data={confidenceBuckets} />
        <SubScoreChart data={subScoreData} />
      </div>

      <div className="border rounded-lg p-4 space-y-2">
        <h3 className="text-sm font-semibold">AI Summary (Overall)</h3>
        <p className="text-xs opacity-60">Threshold-aware summary across score, confidence, and product visibility dimensions.</p>
        <ul className="list-disc pl-5 space-y-1.5 text-sm">
          {aiSummary.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      {/* Drivers Analysis */}
      {drivers.length > 0 && (
        <div className="border rounded-lg p-4 space-y-2">
          <h3 className="text-sm font-semibold">BAD Rating Drivers</h3>
          <p className="text-xs opacity-60">Evidence types most frequently co-occurring with BAD ratings</p>
          <div className="space-y-1.5">
            {drivers.map((d) => (
              <div key={d.type} className="flex items-center gap-2">
                <span className="text-xs font-medium w-28 capitalize">{d.type.replace(/_/g, " ")}</span>
                <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 rounded-full" style={{ width: `${d.pct}%` }} />
                </div>
                <span className="text-xs opacity-70 w-12 text-right">{d.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top 10 Actions */}
      {actionItems.length > 0 && (
        <div className="border rounded-lg p-4 space-y-2">
          <h3 className="text-sm font-semibold">Top Recommended Actions</h3>
          <div className="space-y-1.5 text-sm">
            {actionItems.map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${
                  item.priority === "high" ? "bg-red-100 text-red-700" :
                  "bg-blue-100 text-blue-700"
                }`}>
                  {item.priority}
                </span>
                <span><b>{item.store}:</b> {item.action}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stores Table */}
      <div className="border rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-2">Stores</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2">Customer Code</th>
                <th className="text-left p-2">Store</th>
                <th className="text-left p-2">Last Evaluation</th>
                <th className="text-left p-2">Rating</th>
                <th className="text-left p-2">Score</th>
                <th className="text-left p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((store) => {
                const latest = latestByStore.get(store.id);
                const effectiveRating = latest?.finalRating ?? latest?.aiRating ?? "NEEDS_REVIEW";
                return (
                  <tr key={store.id} className="border-t">
                    <td className="p-2">{store.customerCode}</td>
                    <td className="p-2">{store.name}</td>
                    <td className="p-2">{latest ? latest.capturedAt.toISOString().slice(0, 10) : "-"}</td>
                    <td className="p-2">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${ratingBadge(effectiveRating)}`}>
                        {effectiveRating}
                      </span>
                    </td>
                    <td className="p-2">{latest?.aiScore ?? "-"}</td>
                    <td className="p-2">
                      <Link className="underline" href={`/dashboard/stores/${store.id}`}>
                        View detail
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
