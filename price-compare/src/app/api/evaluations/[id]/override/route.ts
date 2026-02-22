export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireManager, SecurityError } from "@/lib/security";
import { jsonError, withRequestIdHeader } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { managerOverrideSchema } from "@/lib/schemas/evaluation";
import { z } from "zod";

const managerOverrideCompatSchema = z.object({
  newRating: z.enum(["GOOD", "REGULAR", "BAD"]),
  reason: z.string().min(5),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireManager();
    const { id } = await params;

    const body = await req.json();
    const parsed = managerOverrideSchema.safeParse(body);
    const compatParsed = managerOverrideCompatSchema.safeParse(body);
    if (!parsed.success && !compatParsed.success) {
      return jsonError(req, { code: "INVALID_PAYLOAD", message: parsed.error.message }, 400);
    }

    let input: { rating: "GOOD" | "REGULAR" | "BAD"; reason: string };
    if (parsed.success) {
      input = parsed.data;
    } else if (compatParsed.success) {
      input = { rating: compatParsed.data.newRating, reason: compatParsed.data.reason };
    } else {
      return jsonError(req, { code: "INVALID_PAYLOAD", message: parsed.error.message }, 400);
    }

    const evaluation = await prisma.evaluation.findUnique({
      where: { id },
      select: { id: true, aiRating: true, storeId: true },
    });

    if (!evaluation) {
      return jsonError(req, { code: "NOT_FOUND", message: "Evaluation not found" }, 404);
    }

    const updated = await prisma.evaluation.update({
      where: { id },
      data: {
        finalRating: input.rating,
        overriddenById: session.user!.id,
        overriddenAt: new Date(),
        overrideReason: input.reason,
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
        newOverrideRating: input.rating,
        reason: input.reason,
      },
    });

    return NextResponse.json({ ok: true, id: updated.id }, { headers: withRequestIdHeader(req) });
  } catch (error) {
    if (error instanceof SecurityError) {
      return jsonError(req, { code: "SECURITY_ERROR", message: error.message }, error.status);
    }
    return jsonError(req, { code: "INTERNAL_ERROR", message: "Internal Server Error" }, 500);
  }
}
