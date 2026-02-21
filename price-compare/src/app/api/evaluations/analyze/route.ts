export const runtime = "nodejs";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api-response";
import { rateLimitRequest } from "@/lib/rate-limit";
import { saveUpload } from "@/lib/upload";
import { analyzeStorePhotos } from "@/lib/store-evaluation-ai";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const limiter = rateLimitRequest(req, { key: "api:evaluations:analyze", limit: 20, windowMs: 60_000 });
  if (!limiter.ok) {
    return jsonError(req, { code: "RATE_LIMITED", message: "Too many requests" }, 429, { headers: limiter.headers });
  }

  if (!process.env.OPENAI_API_KEY) {
    return jsonError(
      req,
      {
        code: "AI_NOT_CONFIGURED",
        message: "AI analysis is not configured. Set OPENAI_API_KEY in environment variables.",
      },
      503,
      { headers: limiter.headers },
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return jsonError(req, { code: "UNAUTHORIZED", message: "Unauthorized" }, 401);
  }

  const form = await req.formData();
  const storeId = String(form.get("storeId") ?? "").trim();

  const files: Array<{ file: File; photoType: "WIDE_SHOT" | "SHELF_CLOSEUP" | "OTHER" }> = [];
  const photoKeys = ["photo", "photo_1", "photo_2"];
  const photoTypeKeys = ["photoType", "photoType_1", "photoType_2"];

  for (let index = 0; index < photoKeys.length; index++) {
    const file = form.get(photoKeys[index]) as File | null;
    if (!file || file.size <= 0) continue;

    const rawType = String(form.get(photoTypeKeys[index]) ?? "WIDE_SHOT");
    const photoType = rawType === "SHELF_CLOSEUP" || rawType === "OTHER" ? rawType : "WIDE_SHOT";
    files.push({ file, photoType });
  }

  if (files.length === 0) {
    return jsonError(req, { code: "PHOTO_REQUIRED", message: "At least one photo is required" }, 400);
  }

  const photoUrl = await saveUpload(files[0].file);
  const photoDataUrls = await Promise.all(
    files.map(async ({ file }) => {
      const mimeType = file.type || "image/jpeg";
      return `data:${mimeType};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
    }),
  );

  try {
    const [storeData, referenceProducts] = await Promise.all([
      storeId
        ? prisma.store.findUnique({
            where: { id: storeId },
            select: { id: true, customerCode: true, name: true, city: true, zone: true },
          })
        : Promise.resolve(null),
      prisma.product.findMany({
        where: {
          active: true,
          referencePhotos: { some: {} },
        },
        orderBy: { updatedAt: "desc" },
        take: 30,
        select: {
          name: true,
          brand: true,
          referencePhotos: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { url: true, note: true },
          },
        },
      }),
    ]);

    const refs = referenceProducts.flatMap((product) => {
      const photo = product.referencePhotos[0];
      if (!photo?.url) return [];
      return [{
        name: product.name,
        brand: product.brand ?? undefined,
        imageUrl: photo.url,
        note: photo.note ?? undefined,
      }];
    });

    const analysis = await analyzeStorePhotos(photoDataUrls, {
      store: storeData
        ? {
            storeId: storeData.id,
            customerCode: storeData.customerCode,
            name: storeData.name,
            city: storeData.city ?? undefined,
            zone: storeData.zone ?? undefined,
          }
        : undefined,
      ourBrands: Array.from(new Set(refs.map((item) => item.brand).filter((x): x is string => !!x))),
      referenceProducts: refs,
      photoTypes: files.map((item) => item.photoType),
    });

    return jsonOk(req, { photoUrl, analysis }, { headers: limiter.headers });
  } catch (error) {
    const status =
      typeof error === "object" && error !== null && "status" in error && typeof (error as { status?: unknown }).status === "number"
        ? ((error as { status: number }).status)
        : undefined;

    if (status === 429) {
      return jsonError(
        req,
        {
          code: "AI_QUOTA_EXCEEDED",
          message: "OpenAI quota exceeded. Check billing/usage limits and try again later.",
        },
        429,
        { headers: limiter.headers },
      );
    }

    const message = error instanceof Error ? error.message : "AI analysis failed";
    return jsonError(req, { code: "AI_ANALYSIS_FAILED", message }, 500);
  }
}
