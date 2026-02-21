import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, SecurityError } from "@/lib/security";

const schema = z.object({
  customerCode: z.string().min(1).optional(),
  name: z.string().min(2).optional(),
  chain: z.string().optional(),
  zone: z.string().optional(),
  route: z.string().optional(),
  city: z.string().optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  active: z.coerce.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();

    const { id } = await params;
    const body = await req.json();
    const parsed = schema.parse(body);

    const store = await prisma.store.update({
      where: { id },
      data: {
        ...(parsed.customerCode != null ? { customerCode: parsed.customerCode.trim() } : {}),
        ...(parsed.name != null ? { name: parsed.name.trim() } : {}),
        ...(parsed.chain != null ? { chain: parsed.chain.trim() || null } : {}),
        ...(parsed.zone != null ? { zone: parsed.zone.trim() || null } : {}),
        ...(parsed.route != null ? { route: parsed.route.trim() || null } : {}),
        ...(parsed.city != null ? { city: parsed.city || null } : {}),
        ...(parsed.lat != null ? { lat: parsed.lat } : {}),
        ...(parsed.lng != null ? { lng: parsed.lng } : {}),
        ...(parsed.active != null ? { active: parsed.active } : {}),
      },
    });

    return NextResponse.json({ ok: true, store });
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
