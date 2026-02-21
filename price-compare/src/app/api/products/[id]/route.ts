import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, SecurityError } from "@/lib/security";

const schema = z.object({
  segment: z.enum(["LUBRICANTS", "BATTERIES", "TIRES"]).optional(),
  productName: z.string().min(2).optional(),
  specs: z.string().optional(),
  ourPrice: z.coerce.number().positive().optional(),
  referencePhotoUrl: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();

    const { id } = await params;
    const body = await req.json();
    const parsed = schema.parse(body);

    const product = await prisma.ourProduct.update({
      where: { id },
      data: {
        ...(parsed.segment != null ? { segment: parsed.segment } : {}),
        ...(parsed.productName != null ? { productName: parsed.productName } : {}),
        ...(parsed.specs != null ? { specs: parsed.specs || null } : {}),
        ...(parsed.ourPrice != null ? { ourPrice: parsed.ourPrice } : {}),
        ...(parsed.referencePhotoUrl != null ? { referencePhotoUrl: parsed.referencePhotoUrl || null } : {}),
        ...(parsed.isActive != null ? { isActive: parsed.isActive } : {}),
      },
      select: {
        id: true,
        segment: true,
        productName: true,
        specs: true,
        ourPrice: true,
        referencePhotoUrl: true,
        isActive: true,
      },
    });

    return NextResponse.json({
      ok: true,
      product: {
        ...product,
        ourPrice: Number(product.ourPrice),
      },
    });
  } catch (error) {
    if (error instanceof SecurityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload", details: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
