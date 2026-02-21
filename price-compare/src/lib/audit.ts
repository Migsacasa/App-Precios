import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type AuditEvent =
  | "evaluation.created"
  | "evaluation.updated"
  | "evaluation.synced"
  | "evaluation.override"
  | "csv.import.stores"
  | "csv.import.products"
  | "settings.updated"
  | "retention.cleanup"
  | "user.login";

export async function logAudit(params: {
  event: AuditEvent;
  userId?: string;
  evaluationId?: string;
  storeId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        event: params.event,
        userId: params.userId ?? null,
        evaluationId: params.evaluationId ?? null,
        storeId: params.storeId ?? null,
        metadata: (params.metadata ?? null) as Prisma.InputJsonValue,
      },
    });
  } catch (e) {
    // Never let audit logging crash the main flow
    console.error("Audit log failed:", e);
  }
}
