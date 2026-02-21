export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireManager } from "@/lib/security";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { managerOverrideSchema } from "@/lib/schemas/evaluation";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireManager();
  const { id } = await params;

  const body = await req.json();
  const parsed = managerOverrideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const evaluation = await prisma.evaluation.findUnique({
    where: { id },
    select: { id: true, aiRating: true, storeId: true },
  });

  if (!evaluation) {
    return NextResponse.json({ error: "Evaluation not found" }, { status: 404 });
  }

  const updated = await prisma.evaluation.update({
    where: { id },
    data: {
      finalRating: parsed.data.rating,
      overriddenById: session.user!.id,
      overriddenAt: new Date(),
      overrideReason: parsed.data.reason,
    },
  });

  await logAudit({
    action: "MANAGER_OVERRIDE_APPLIED",
    actorId: session.user!.id,
    entityType: "Evaluation",
    entityId: id,
    meta: {
      storeId: evaluation.storeId,
      previousAiRating: evaluation.aiRating,
      newOverrideRating: parsed.data.rating,
      reason: parsed.data.reason,
    },
  });

  return NextResponse.json({ ok: true, id: updated.id });
}
