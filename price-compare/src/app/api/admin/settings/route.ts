import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, SecurityError } from "@/lib/security";
import { getSettings, setSetting } from "@/lib/settings";
import { z } from "zod";

const updateSchema = z.object({
  key: z.string().min(1),
  value: z.string().min(1),
});

export async function GET() {
  try {
    await requireAdmin();
    const settings = await getSettings();
    return NextResponse.json(settings);
  } catch (e) {
    if (e instanceof SecurityError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    await setSetting(parsed.data.key, parsed.data.value, { actorId: session.user!.id });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof SecurityError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
