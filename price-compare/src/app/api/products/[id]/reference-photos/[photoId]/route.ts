import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, withRequestIdHeader } from "@/lib/api-response";
import { requireAdmin, SecurityError } from "@/lib/security";
import { logAudit } from "@/lib/audit";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> },
) {
  try {
    const session = await requireAdmin();
    const { id, photoId } = await params;

    const existing = await prisma.productReferencePhoto.findFirst({
      where: { id: photoId, productId: id },
      select: { id: true, productId: true },
    });

    if (!existing) {
      return jsonError(req, { code: "NOT_FOUND", message: "Reference photo not found" }, 404);
    }

    await prisma.productReferencePhoto.delete({ where: { id: existing.id } });

    await logAudit({
      action: "PHOTO_DELETED",
      actorId: session.user.id,
      entityType: "ProductReferencePhoto",
      entityId: existing.id,
      meta: { productId: existing.productId },
    });

    return NextResponse.json({ ok: true }, { headers: withRequestIdHeader(req) });
  } catch (error) {
    if (error instanceof SecurityError) {
      return jsonError(req, { code: "SECURITY_ERROR", message: error.message }, error.status);
    }
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return jsonError(req, { code: "INTERNAL_ERROR", message }, 500);
  }
}
