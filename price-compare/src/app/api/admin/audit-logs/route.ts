import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, SecurityError } from "@/lib/security";
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

    return NextResponse.json({
      data: rows,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (e) {
    if (e instanceof SecurityError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
