import { randomUUID } from "node:crypto";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api-response";

const inviteSchema = z.object({
  type: z.enum(["email", "whatsapp"]),
  target: z.string().min(3),
  message: z.string().max(500).optional(),
});

type InviteRecord = {
  id: string;
  type: "email" | "whatsapp";
  target: string;
  message: string | null;
  status: "sent";
  createdAt: string;
};

const inviteHistory: InviteRecord[] = [];

function normalizePhone(value: string) {
  const trimmed = value.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  return hasPlus ? `+${digits}` : digits;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return jsonError(req, { code: "UNAUTHORIZED", message: "Unauthorized" }, 401);
  }

  return jsonOk(req, inviteHistory.slice(0, 50));
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return jsonError(req, { code: "UNAUTHORIZED", message: "Unauthorized" }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(req, { code: "INVALID_JSON", message: "Invalid JSON body" }, 400);
  }

  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(req, { code: "VALIDATION_FAILED", message: parsed.error.message }, 400);
  }

  const { type, message } = parsed.data;
  const target = parsed.data.target.trim();
  const text = (message?.trim() || "Te invito a usar Retail Evaluator para capturas y reportes.").trim();

  const id = randomUUID();
  const createdAt = new Date().toISOString();

  if (type === "whatsapp") {
    const normalizedPhone = normalizePhone(target);
    if (!normalizedPhone) {
      return jsonError(req, { code: "INVALID_PHONE", message: "Invalid WhatsApp phone number" }, 400);
    }

    const whatsappUrl = `https://wa.me/${normalizedPhone.replace(/^\+/, "")}?text=${encodeURIComponent(text)}`;
    inviteHistory.unshift({
      id,
      type,
      target: normalizedPhone,
      message: text,
      status: "sent",
      createdAt,
    });
    inviteHistory.splice(100);

    return jsonOk(req, { id, type, target: normalizedPhone, status: "sent", createdAt, whatsappUrl });
  }

  const email = target.toLowerCase();
  if (!z.string().email().safeParse(email).success) {
    return jsonError(req, { code: "INVALID_EMAIL", message: "Invalid email address" }, 400);
  }

  const subject = "Invitación a Retail Evaluator";
  const mailtoUrl = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;

  inviteHistory.unshift({
    id,
    type,
    target: email,
    message: text,
    status: "sent",
    createdAt,
  });
  inviteHistory.splice(100);

  return jsonOk(req, { id, type, target: email, status: "sent", createdAt, mailtoUrl });
}
