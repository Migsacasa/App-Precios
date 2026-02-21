import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Pagination } from "@/components/pagination";

const PAGE_SIZE = 50;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: Promise<{ from?: string; to?: string; city?: string; page?: string }>;
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
  const currentPage = Math.max(1, parseInt(params?.page ?? "1", 10) || 1);

  const query = new URLSearchParams({ from: from.toISOString(), to: to.toISOString(), ...(city ? { city } : {}) }).toString();

  const where = {
    capturedAt: { gte: from, lte: to },
    ...(city ? { store: { city } } : {}),
  };

  const [evaluations, totalCount] = await Promise.all([
    prisma.evaluation.findMany({
      where,
      include: {
        store: true,
        segmentIndices: { orderBy: [{ segment: "asc" }, { slot: "asc" }] },
      },
      orderBy: { capturedAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.evaluation.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Evaluation Reports</h1>
        <div className="flex gap-2 flex-wrap">
          <a href={`/api/reports/export?${query}&type=history`} className="rounded border px-3 py-2 text-sm">
            CSV (History)
          </a>
          <a href={`/api/reports/export?${query}&type=snapshot`} className="rounded border px-3 py-2 text-sm">
            CSV (Snapshot)
          </a>
          <a href={`/api/reports/export/pdf?${query}`} className="rounded border px-3 py-2 text-sm">
            Download PDF
          </a>
        </div>
      </div>

      <div className="overflow-x-auto border rounded">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-2">Date</th>
              <th className="text-left p-2">Customer Code</th>
              <th className="text-left p-2">Store</th>
              <th className="text-left p-2">AI Rating</th>
              <th className="text-left p-2">Price Index Slots</th>
            </tr>
          </thead>
          <tbody>
            {evaluations.map((evaluation) => (
              <tr key={evaluation.id} className="border-t align-top">
                <td className="p-2">{evaluation.capturedAt.toISOString().slice(0, 10)}</td>
                <td className="p-2">{evaluation.store.customerCode}</td>
                <td className="p-2">{evaluation.store.name}</td>
                <td className="p-2">{evaluation.aiRating ?? "PENDING"}</td>
                <td className="p-2">
                  {evaluation.segmentIndices.map((slot) => `${slot.segment}#${slot.slot}: ${Number(slot.priceIndex ?? 0).toFixed(1)}`).join(" · ")}
                </td>
              </tr>
            ))}
            {!evaluations.length && (
              <tr>
                <td className="p-4 text-muted-foreground" colSpan={5}>
                  No evaluations in selected range.
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
