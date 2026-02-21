import { NextResponse } from "next/server";
import { requireAdmin, SecurityError } from "@/lib/security";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { getRetentionMonths } from "@/lib/settings";

export async function POST() {
  try {
    const session = await requireAdmin();

    const retentionMonths = await getRetentionMonths();
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - retentionMonths);

    // Delete old photos (files remain on disk but DB records removed)
    const deletedPhotos = await prisma.evaluationPhoto.deleteMany({
      where: {
        evaluation: {
          createdAt: { lt: cutoff },
        },
      },
    });

    // Delete old evaluations along with their segment inputs
    const oldEvaluations = await prisma.storeEvaluation.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true },
    });

    const evalIds = oldEvaluations.map((e) => e.id);

    if (evalIds.length > 0) {
      await prisma.evaluationSegmentInput.deleteMany({
        where: { evaluationId: { in: evalIds } },
      });
      await prisma.storeEvaluation.deleteMany({
        where: { id: { in: evalIds } },
      });
    }

    // Delete old audit logs (older than double retention)
    const auditCutoff = new Date();
    auditCutoff.setMonth(auditCutoff.getMonth() - retentionMonths * 2);
    const deletedAudit = await prisma.auditLog.deleteMany({
      where: { createdAt: { lt: auditCutoff } },
    });

    await logAudit({
      event: "retention.cleanup",
      userId: session.user!.id,
      metadata: {
        retentionMonths,
        cutoff: cutoff.toISOString(),
        deletedPhotos: deletedPhotos.count,
        deletedEvaluations: evalIds.length,
        deletedAuditLogs: deletedAudit.count,
      },
    });

    return NextResponse.json({
      ok: true,
      retentionMonths,
      cutoff: cutoff.toISOString(),
      deletedPhotos: deletedPhotos.count,
      deletedEvaluations: evalIds.length,
      deletedAuditLogs: deletedAudit.count,
    });
  } catch (e) {
    if (e instanceof SecurityError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("Retention cleanup error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
