import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, SecurityError } from "@/lib/security";
import { jsonError, withRequestIdHeader } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10)));
    const action = url.searchParams.get("action") ?? undefined;
    const actorId = url.searchParams.get("actorId") ?? undefined;

    const where: Record<string, unknown> = {};
    if (action) where.action = action;
    if (actorId) where.actorId = actorId;

    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          actor: { select: { id: true, name: true, role: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json(
      {
        data: rows,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      { headers: withRequestIdHeader(req) },
    );
  } catch (e) {
    if (e instanceof SecurityError) {
      return jsonError(req, { code: "SECURITY_ERROR", message: e.message }, e.status);
    }
    return jsonError(req, { code: "INTERNAL_ERROR", message: "Internal Server Error" }, 500);
  }
}
