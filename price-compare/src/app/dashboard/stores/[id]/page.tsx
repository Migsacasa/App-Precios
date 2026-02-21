import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ManagerOverrideForm } from "@/components/dashboard/manager-override-form";

function ratingBadge(rating: string) {
  const map: Record<string, string> = {
    GOOD: "bg-green-100 text-green-800",
    REGULAR: "bg-yellow-100 text-yellow-800",
    BAD: "bg-red-100 text-red-800",
    NEEDS_REVIEW: "bg-orange-100 text-orange-800",
    PENDING: "bg-gray-100 text-gray-800",
  };
  return map[rating] ?? "bg-gray-100 text-gray-800";
}

export default async function StoreDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ from?: string; to?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (!session.user.role || !["MANAGER", "ADMIN"].includes(session.user.role)) {
    redirect("/observations");
  }

  const { id } = await params;
  const filters = await searchParams;
  const from = filters?.from ? new Date(filters.from) : undefined;
  const to = filters?.to ? new Date(filters.to) : undefined;
  const isManager = session.user.role === "MANAGER" || session.user.role === "ADMIN";

  const store = await prisma.store.findUnique({
    where: { id },
    include: {
      evaluations: {
        where: from || to ? { capturedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : undefined,
        orderBy: { capturedAt: "desc" },
        include: {
          photos: true,
          segmentIndices: { orderBy: [{ segment: "asc" }, { slot: "asc" }] },
          createdBy: { select: { name: true, email: true } },
          overriddenBy: { select: { name: true } },
          aiEvaluation: true,
          aiFindings: true,
          aiRecommendations: true,
        },
      },
    },
  });

  if (!store) notFound();

  const latest = store.evaluations[0];
  const effectiveRating = latest?.finalRating ?? latest?.aiRating ?? "NEEDS_REVIEW";
  const aiOutput = latest?.aiEvaluation?.outputJson as Record<string, unknown> | null;
  const summary = (aiOutput?.summary as string) ?? null;

  return (
    <div className="space-y-4 max-w-5xl mx-auto p-6">
      <Breadcrumbs />
      <h1 className="text-xl font-semibold">
        {store.customerCode} · {store.name}
      </h1>
      <p className="text-sm opacity-80">
        {store.city || "No city"}{store.zone ? ` · Zone: ${store.zone}` : ""}{store.route ? ` · Route: ${store.route}` : ""} · {Number(store.lat)}, {Number(store.lng)}
      </p>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Latest AI Review Card */}
        <div className="border rounded-lg p-4 space-y-3">
          <h3 className="font-semibold">Latest evaluation</h3>

          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-1 rounded text-xs font-semibold ${ratingBadge(effectiveRating)}`}>
              {effectiveRating}
            </span>
            {latest?.finalRating && latest.finalRating !== latest.aiRating && (
              <span className="text-xs opacity-70">(override by {latest.overriddenBy?.name ?? "manager"})</span>
            )}
            {latest?.aiScore != null && (
              <span className="text-sm font-medium">Score: {latest.aiScore}/100</span>
            )}
            {latest?.aiConfidence != null && (
              <span className="text-xs opacity-70">Confidence: {(latest.aiConfidence * 100).toFixed(0)}%</span>
            )}
          </div>

          {latest?.aiConfidence != null && latest.aiConfidence < 0.35 && (
            <div className="rounded border border-orange-300 bg-orange-50 p-2 text-xs text-orange-800">
              Low confidence — manager review recommended.
            </div>
          )}

          <p className="text-sm">{summary ?? "No summary available"}</p>

          {latest?.aiFindings && latest.aiFindings.length > 0 && (
            <ul className="list-disc pl-5 text-sm space-y-1">
              {latest.aiFindings.map((item) => <li key={item.id}>[{item.type}] {item.detail}</li>)}
            </ul>
          )}

          {/* Photos gallery */}
          {latest?.photos && latest.photos.length > 0 && (
            <div className="flex gap-2 overflow-x-auto">
              {latest.photos.map((photo) => (
                <a key={photo.id} href={photo.url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt={photo.photoType ?? "Photo"} className="h-20 rounded border object-cover" />
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Evidence + Recommendations */}
        <div className="border rounded-lg p-4 space-y-3">
          <h3 className="font-semibold">Evidence & Recommendations</h3>

          {latest?.aiFindings && latest.aiFindings.length > 0 ? (
            <div className="space-y-1 text-sm">
              {latest.aiFindings.map((e) => (
                <div key={e.id} className="flex gap-2 items-start">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${
                    e.severity === "HIGH" ? "bg-red-100 text-red-700" :
                    e.severity === "MEDIUM" ? "bg-yellow-100 text-yellow-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>
                    {e.type}
                  </span>
                  <span>{e.detail}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm opacity-60">No evidence data yet.</p>
          )}

          {latest?.aiRecommendations && latest.aiRecommendations.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <h4 className="text-sm font-medium">Recommendations</h4>
              {latest.aiRecommendations.map((r) => (
                <div key={r.id} className="text-sm">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                    r.priority === "P0" ? "bg-red-100 text-red-700" : r.priority === "P1" ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"
                  }`}>
                    {r.priority}
                  </span>{" "}
                  <b>{r.action}</b>{r.rationale ? ` — ${r.rationale}` : ""}
                </div>
              ))}
            </div>
          )}

          {/* Map link */}
          <div className="pt-2 border-t">
            <p className="text-sm">Lat: {Number(store.lat)} · Lng: {Number(store.lng)}</p>
            <a
              className="underline text-sm"
              href={`https://www.openstreetmap.org/?mlat=${Number(store.lat)}&mlon=${Number(store.lng)}#map=16/${Number(store.lat)}/${Number(store.lng)}`}
              target="_blank"
            >
              Open in OpenStreetMap
            </a>
          </div>
        </div>
      </div>

      {/* Manager Override */}
      {isManager && latest && (
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-2">Manager Override</h3>
          {latest.finalRating && latest.finalRating !== latest.aiRating ? (
            <div className="text-sm space-y-1">
              <p>Current override: <span className={`px-2 py-0.5 rounded text-xs font-semibold ${ratingBadge(latest.finalRating)}`}>{latest.finalRating}</span></p>
              <p className="text-xs opacity-70">By: {latest.overriddenBy?.name ?? "Unknown"} · Reason: {latest.overrideReason ?? "-"}</p>
            </div>
          ) : (
            <ManagerOverrideForm evaluationId={latest.id} currentRating={latest.aiRating ?? "NEEDS_REVIEW"} />
          )}
        </div>
      )}

      {/* Evaluation History Table */}
      <div className="border rounded-lg p-4">
        <h3 className="font-semibold mb-2">Evaluation history</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2">Date</th>
                <th className="text-left p-2">Evaluator</th>
                <th className="text-left p-2">AI Rating</th>
                <th className="text-left p-2">Score</th>
                <th className="text-left p-2">Override</th>
                <th className="text-left p-2">Summary</th>
                <th className="text-left p-2">Segments</th>
              </tr>
            </thead>
            <tbody>
              {store.evaluations.map((evaluation) => (
                <tr key={evaluation.id} className="border-t align-top">
                  <td className="p-2 whitespace-nowrap">{evaluation.capturedAt.toISOString().slice(0, 10)}</td>
                  <td className="p-2">{evaluation.createdBy?.name ?? evaluation.createdBy?.email ?? "-"}</td>
                  <td className="p-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${ratingBadge(evaluation.aiRating ?? "NEEDS_REVIEW")}`}>
                      {evaluation.aiRating ?? "PENDING"}
                    </span>
                  </td>
                  <td className="p-2">{evaluation.aiScore ?? "-"}</td>
                  <td className="p-2">
                    {evaluation.finalRating && evaluation.finalRating !== evaluation.aiRating ? (
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${ratingBadge(evaluation.finalRating)}`}>
                        {evaluation.finalRating}
                      </span>
                    ) : "-"}
                  </td>
                  <td className="p-2 max-w-xs truncate">{(evaluation.aiEvaluation?.outputJson as Record<string, unknown> | null)?.summary as string || "-"}</td>
                  <td className="p-2">
                    <ul className="space-y-1">
                      {evaluation.segmentIndices.map((input) => (
                        <li key={input.id}>
                          {input.segment} #{input.slot}: {Number(input.priceIndex ?? 0).toFixed(2)}
                          {input.competitorPrice && input.ourPrice ? (
                            <span className="text-xs opacity-60"> (${Number(input.competitorPrice).toFixed(2)}/${Number(input.ourPrice).toFixed(2)})</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
              {!store.evaluations.length && (
                <tr>
                  <td className="p-3 text-muted-foreground" colSpan={7}>
                    No evaluations found for selected range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
