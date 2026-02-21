import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET — list invitations sent by the current user
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const invitations = await prisma.invitation.findMany({
    where: { sentById: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(invitations);
}

// POST — send a new invitation
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { type, target, message } = body as {
    type: string;
    target: string;
    message?: string;
  };

  // Validate type
  if (!type || !["email", "whatsapp"].includes(type)) {
    return NextResponse.json(
      { error: "type must be 'email' or 'whatsapp'" },
      { status: 400 }
    );
  }

  // Validate target
  if (!target || target.trim().length === 0) {
    return NextResponse.json(
      { error: "target (email or phone number) is required" },
      { status: 400 }
    );
  }

  // Basic email validation
  if (type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target.trim())) {
    return NextResponse.json(
      { error: "Invalid email address" },
      { status: 400 }
    );
  }

  // Basic phone validation (digits, spaces, dashes, plus sign, 7-20 chars)
  if (
    type === "whatsapp" &&
    !/^\+?[\d\s\-()]{7,20}$/.test(target.trim())
  ) {
    return NextResponse.json(
      { error: "Invalid phone number" },
      { status: 400 }
    );
  }

  const cleanTarget = target.trim();

  // Build the invite URL (uses NEXTAUTH_URL or current host)
  const appUrl =
    process.env.NEXTAUTH_URL || "http://localhost:3000";

  const defaultMessage =
    `You've been invited to use Retail Evaluator! Join here: ${appUrl}/login`;

  const finalMessage = message?.trim()
    ? `${message.trim()}\n\n${appUrl}/login`
    : defaultMessage;

  // For WhatsApp, open a pre-filled link (client handles the redirect)
  let whatsappUrl: string | null = null;
  if (type === "whatsapp") {
    const phone = cleanTarget.replace(/[\s\-()]/g, "");
    whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(finalMessage)}`;
  }

  // Save invitation record
  const invitation = await prisma.invitation.create({
    data: {
      type,
      target: cleanTarget,
      message: finalMessage,
      sentById: session.user.id,
      status: "sent",
    },
  });

  return NextResponse.json({
    invitation,
    whatsappUrl,
  });
}
