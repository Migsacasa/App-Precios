export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { saveUpload } from "@/lib/upload";
import { analyzeStorePhoto } from "@/lib/store-evaluation-ai";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("photo") as File | null;

  if (!file || file.size <= 0) {
    return NextResponse.json({ error: "Photo is required" }, { status: 400 });
  }

  const photoUrl = await saveUpload(file);

  try {
    const analysis = await analyzeStorePhoto(photoUrl);
    return NextResponse.json({ photoUrl, analysis });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
