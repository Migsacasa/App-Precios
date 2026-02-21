import { NextRequest } from "next/server";
import { requireAdmin, SecurityError } from "@/lib/security";
import { jsonError, jsonOk } from "@/lib/api-response";
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
    return jsonOk(undefined, settings);
  } catch (e) {
    if (e instanceof SecurityError) {
      return jsonError(undefined, { code: "SECURITY_ERROR", message: e.message }, e.status);
    }
    return jsonError(undefined, { code: "INTERNAL_ERROR", message: "Internal Server Error" }, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(req, { code: "INVALID_PAYLOAD", message: parsed.error.message }, 400);
    }

    await setSetting(parsed.data.key, parsed.data.value, { actorId: session.user!.id });

    return jsonOk(req, { ok: true });
  } catch (e) {
    if (e instanceof SecurityError) {
      return jsonError(req, { code: "SECURITY_ERROR", message: e.message }, e.status);
    }
    return jsonError(req, { code: "INTERNAL_ERROR", message: "Internal Server Error" }, 500);
  }
}
