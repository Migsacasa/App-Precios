import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, withRequestIdHeader } from "@/lib/api-response";
import { requireAdmin, SecurityError } from "@/lib/security";
import { saveUpload, UploadValidationError } from "@/lib/upload";
import { logAudit } from "@/lib/audit";

const postSchema = z.object({
  note: z.string().max(200).optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;

    const photos = await prisma.productReferencePhoto.findMany({
      where: { productId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        url: true,
        note: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ ok: true, photos }, { headers: withRequestIdHeader(req) });
  } catch (error) {
    if (error instanceof SecurityError) {
      return jsonError(req, { code: "SECURITY_ERROR", message: error.message }, error.status);
    }
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return jsonError(req, { code: "INTERNAL_ERROR", message }, 500);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;

    const product = await prisma.product.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!product) {
      return jsonError(req, { code: "NOT_FOUND", message: "Product not found" }, 404);
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const noteRaw = String(form.get("note") ?? "").trim();
    const parsed = postSchema.parse({ note: noteRaw || undefined });

    if (!file || file.size <= 0) {
      return jsonError(req, { code: "FILE_REQUIRED", message: "Image file is required" }, 400);
    }

    const url = await saveUpload(file, `product-${id}`);

    const created = await prisma.productReferencePhoto.create({
      data: {
        productId: id,
        url,
        note: parsed.note ?? null,
      },
      select: {
        id: true,
        url: true,
        note: true,
        createdAt: true,
      },
    });

    await logAudit({
      action: "PHOTO_UPLOADED",
      actorId: session.user.id,
      entityType: "ProductReferencePhoto",
      entityId: created.id,
      meta: {
        productId: id,
        productName: product.name,
      },
    });

    return NextResponse.json({ ok: true, photo: created }, { headers: withRequestIdHeader(req) });
  } catch (error) {
    if (error instanceof SecurityError) {
      return jsonError(req, { code: "SECURITY_ERROR", message: error.message }, error.status);
    }
    if (error instanceof UploadValidationError) {
      return jsonError(req, { code: "UPLOAD_VALIDATION_ERROR", message: error.message }, 400);
    }
    if (error instanceof z.ZodError) {
      return jsonError(req, { code: "INVALID_PAYLOAD", message: "Invalid payload", details: error.flatten() }, 400);
    }
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return jsonError(req, { code: "INTERNAL_ERROR", message }, 500);
  }
}
