import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, withRequestIdHeader } from "@/lib/api-response";
import { requireAdmin, SecurityError } from "@/lib/security";

const schema = z.object({
  segment: z.enum(["LUBRICANTS", "BATTERIES", "TIRES"]).optional(),
  name: z.string().min(2).optional(),
  brand: z.string().optional(),
  category: z.string().optional(),
  active: z.coerce.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();

    const { id } = await params;
    const body = await req.json();
    const parsed = schema.parse(body);

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(parsed.segment != null ? { segment: parsed.segment } : {}),
        ...(parsed.name != null ? { name: parsed.name } : {}),
        ...(parsed.brand != null ? { brand: parsed.brand || null } : {}),
        ...(parsed.category != null ? { category: parsed.category || null } : {}),
        ...(parsed.active != null ? { active: parsed.active } : {}),
      },
      select: {
        id: true,
        sku: true,
        segment: true,
        name: true,
        brand: true,
        category: true,
        active: true,
      },
    });

    return NextResponse.json({ ok: true, product }, { headers: withRequestIdHeader(req) });
  } catch (error) {
    if (error instanceof SecurityError) {
      return jsonError(req, { code: "SECURITY_ERROR", message: error.message }, error.status);
    }
    if (error instanceof z.ZodError) {
      return jsonError(req, { code: "INVALID_PAYLOAD", message: "Invalid payload", details: error.flatten() }, 400);
    }
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return jsonError(req, { code: "INTERNAL_ERROR", message }, 500);
  }
}
