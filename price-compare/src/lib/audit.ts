import { prisma } from "@/lib/prisma";
import type { AuditAction, Prisma } from "@prisma/client";

export type { AuditAction };

export async function logAudit(params: {
  action: AuditAction;
  actorId?: string;
  entityType: string;
  entityId: string;
  meta?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        actorId: params.actorId ?? null,
        entityType: params.entityType,
        entityId: params.entityId,
        meta: (params.meta ?? null) as Prisma.InputJsonValue,
        ip: params.ip ?? null,
        userAgent: params.userAgent ?? null,
      },
    });
  } catch (e) {
    // Never let audit logging crash the main flow
    console.error("Audit log failed:", e);
  }
}
