import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const registerSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(72),
  name: z.string().min(1).max(80).optional(),
});

export async function POST(req: Request) {
  let payload: unknown;

  try {
    payload = await req.json();
  } catch {
    return jsonError(req, { code: "INVALID_JSON", message: "Invalid JSON body" }, 400);
  }

  const parsed = registerSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError(req, { code: "VALIDATION_FAILED", message: parsed.error.message }, 400);
  }

  const email = parsed.data.email.trim().toLowerCase();
  const name = parsed.data.name?.trim() || null;
  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  try {
    const user = await prisma.user.create({
      data: {
        email,
        name,
        role: "FIELD",
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    await logAudit({
      action: "STORE_CREATED",
      actorId: user.id,
      entityType: "User",
      entityId: user.id,
      meta: {
        source: "self-registration",
        email: user.email,
        role: user.role,
      },
    });

    return jsonOk(req, user, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonError(req, { code: "EMAIL_EXISTS", message: "An account with this email already exists" }, 409);
    }

    return jsonError(req, { code: "REGISTER_FAILED", message: "Failed to create account" }, 500);
  }
}
