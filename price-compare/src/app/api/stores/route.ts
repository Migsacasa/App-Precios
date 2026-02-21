import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireRole, SecurityError } from "@/lib/security";

const schema = z.object({
  customerCode: z.string().min(1),
  name: z.string().min(2),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  city: z.string().optional(),
  zone: z.string().optional(),
  route: z.string().optional(),
  chain: z.string().optional(),
});

export async function GET() {
  try {
    await requireRole("FIELD");

    const stores = await prisma.store.findMany({
      orderBy: [{ city: "asc" }, { name: "asc" }],
      select: {
        id: true,
        customerCode: true,
        name: true,
        lat: true,
        lng: true,
        city: true,
        zone: true,
        route: true,
        chain: true,
        active: true,
      },
    });

    return NextResponse.json({ stores });
  } catch (error) {
    if (error instanceof SecurityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const body = await req.json();
    const parsed = schema.parse(body);

    const store = await prisma.store.create({
      data: {
        customerCode: parsed.customerCode.trim(),
        name: parsed.name.trim(),
        lat: parsed.lat,
        lng: parsed.lng,
        city: parsed.city?.trim() || null,
        zone: parsed.zone?.trim() || null,
        route: parsed.route?.trim() || null,
        chain: parsed.chain?.trim() || null,
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
