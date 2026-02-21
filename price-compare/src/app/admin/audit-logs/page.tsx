import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AuditAction } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Pagination } from "@/components/pagination";

const PAGE_SIZE = 50;

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; event?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/observations");

  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params?.page ?? "1", 10) || 1);
  const actionFilter = params?.event ?? undefined;
  const normalizedAction = actionFilter && Object.values(AuditAction).includes(actionFilter as AuditAction)
    ? (actionFilter as AuditAction)
    : undefined;

  const where = normalizedAction ? { action: normalizedAction } : {};

  const [logs, totalCount] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        actor: { select: { name: true, email: true, role: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const actionTypes = await prisma.auditLog.groupBy({
    by: ["action"],
    _count: { action: true },
    orderBy: { _count: { action: "desc" } },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Audit Logs</h1>
      <p className="text-sm opacity-80">Track all system events — evaluation creation, overrides, CSV imports, settings changes.</p>

      {/* Event type filter */}
      <div className="flex flex-wrap gap-2 text-xs">
        <a
          href="/admin/audit-logs"
          className={`border rounded px-2 py-1 ${!actionFilter ? "bg-foreground text-background" : "hover:bg-foreground/5"}`}
        >
          All ({totalCount})
        </a>
        {actionTypes.map((et) => (
          <a
            key={et.action}
            href={`/admin/audit-logs?event=${et.action}`}
            className={`border rounded px-2 py-1 ${actionFilter === et.action ? "bg-foreground text-background" : "hover:bg-foreground/5"}`}
          >
            {et.action} ({et._count.action})
          </a>
        ))}
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-2">Time</th>
              <th className="text-left p-2">Event</th>
              <th className="text-left p-2">User</th>
              <th className="text-left p-2">Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => {
              const meta = log.meta as Record<string, unknown> | null;
              const isSelfRegistration =
                log.entityType === "User" &&
                log.action === "STORE_CREATED" &&
                meta?.source === "self-registration";

              return (
                <tr key={log.id} className="border-t align-top">
                  <td className="p-2 whitespace-nowrap">{log.createdAt.toISOString().replace("T", " ").slice(0, 19)}</td>
                  <td className="p-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-muted">{log.action}</span>
                      {isSelfRegistration && (
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600">
                          Self-registration
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-2">{log.actor?.name ?? log.actor?.email ?? log.actorId ?? "System"}</td>
                  <td className="p-2 max-w-md">
                    {meta ? (
                      <pre className="text-xs overflow-x-auto whitespace-pre-wrap">{JSON.stringify(meta, null, 2)}</pre>
                    ) : (
                      <span className="opacity-60">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!logs.length && (
              <tr>
                <td className="p-4 text-muted-foreground" colSpan={4}>No audit logs found.</td>
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
