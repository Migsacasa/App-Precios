import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Pagination } from "@/components/pagination";

const PAGE_SIZE = 25;

export default async function ObservationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params?.page ?? "1", 10) || 1);

  let evaluations: Awaited<ReturnType<typeof prisma.evaluation.findMany<{
    include: { store: true; segmentIndices: true; photos: true; createdBy: true };
  }>>> = [];
  let totalCount = 0;
  let error: string | null = null;

  const where = session.user.role === "FIELD" ? { createdById: session.user.id } : undefined;

  try {
    [evaluations, totalCount] = await Promise.all([
      prisma.evaluation.findMany({
        where,
        orderBy: { capturedAt: "desc" },
        skip: (currentPage - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          store: true,
          segmentIndices: true,
          photos: true,
          createdBy: true,
        },
      }),
      prisma.evaluation.count({ where }),
    ]);
  } catch (e) {
    console.error("Failed to load evaluations:", e);
    error = "Could not load evaluations. Please try again later.";
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Latest Store Evaluations</h1>
        <div className="flex gap-2">
          {(session.user.role === "MANAGER" || session.user.role === "ADMIN") && (
            <Link className="border rounded px-3 py-2" href="/dashboard">
              Dashboard
            </Link>
          )}
          {(session.user.role === "MANAGER" || session.user.role === "ADMIN") && (
            <Link className="border rounded px-3 py-2" href="/reports">
              Reports
            </Link>
          )}
          <Link className="bg-black text-white rounded px-3 py-2" href="/observations/new">
            + New
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto border rounded">
        {error && (
          <div className="p-4 text-sm text-red-600 bg-red-50 rounded">
            {error}
          </div>
        )}
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-2">Date</th>
              <th className="text-left p-2">Store</th>
              <th className="text-left p-2">Evaluator</th>
              <th className="text-left p-2">AI Rating</th>
              <th className="text-right p-2">Slots</th>
              <th className="text-left p-2">Photo</th>
            </tr>
          </thead>
          <tbody>
            {evaluations.map((evaluation) => (
              <tr key={evaluation.id} className="border-t">
                <td className="p-2">{evaluation.capturedAt.toISOString().slice(0, 10)}</td>
                <td className="p-2">
                  {evaluation.store.customerCode} · {evaluation.store.name}
                </td>
                <td className="p-2">{evaluation.createdBy.name || evaluation.createdBy.email}</td>
                <td className="p-2">{evaluation.aiRating ?? "PENDING"}</td>
                <td className="p-2 text-right">{evaluation.segmentIndices.length}</td>
                <td className="p-2">
                  {evaluation.photos[0]?.url ? (
                    <a className="underline" href={evaluation.photos[0].url} target="_blank" rel="noopener noreferrer">
                      view
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))}
            {!evaluations.length && (
              <tr>
                <td className="p-4 text-gray-500" colSpan={6}>
                  No evaluations yet. Capture your first visit from the New button.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <Pagination currentPage={currentPage} totalPages={totalPages} />
      )}
    </div>
  );
}