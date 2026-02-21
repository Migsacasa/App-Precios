import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, SecurityError } from "@/lib/security";
import { jsonError, withRequestIdHeader } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const VALID_SEGMENTS = ["LUBRICANTS", "BATTERIES", "TIRES"] as const;

const rowSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1).optional(),
  segment: z.enum(VALID_SEGMENTS).optional(),
  ourPrice: z.coerce.number().positive().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return jsonError(req, { code: "FILE_REQUIRED", message: "CSV file required" }, 400);
    }

    const text = await file.text();
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      return jsonError(req, { code: "INVALID_CSV", message: "CSV must have header + at least 1 row" }, 400);
    }

    // Parse header
    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const nameIdx = header.indexOf("name");
    const skuIdx = header.indexOf("sku");
    const segmentIdx = header.indexOf("segment");
    const priceIdx = header.findIndex((h) => h === "ourprice" || h === "our_price" || h === "price");

    if (nameIdx < 0) {
      return jsonError(req, { code: "INVALID_CSV", message: "CSV must have a 'name' column" }, 400);
    }

    const results = { created: 0, updated: 0, errors: [] as string[] };

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim());
      const raw = {
        name: cols[nameIdx] ?? "",
        sku: skuIdx >= 0 ? cols[skuIdx] : undefined,
        segment: segmentIdx >= 0 ? cols[segmentIdx]?.toUpperCase() : undefined,
        ourPrice: priceIdx >= 0 ? cols[priceIdx] : undefined,
      };

      const parsed = rowSchema.safeParse(raw);
      if (!parsed.success) {
        results.errors.push(`Row ${i + 1}: ${parsed.error.issues.map((e) => e.message).join(", ")}`);
        continue;
      }

      const { name, sku, segment, ourPrice } = parsed.data;
      const productSku = sku ?? `AUTO-${name.replace(/\s+/g, "-").toUpperCase()}`;

      // Upsert product by sku
      const existing = await prisma.product.findUnique({
        where: { sku: productSku },
      });

      if (existing) {
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            name,
            ...(segment ? { segment } : {}),
          },
        });

        // Record price version if price provided
        if (ourPrice) {
          await prisma.productPriceVersion.create({
            data: {
              productId: existing.id,
              ourPrice: ourPrice,
              effectiveFrom: new Date(),
              createdById: session.user!.id,
            },
          });
        }

        results.updated++;
      } else {
        const product = await prisma.product.create({
          data: {
            sku: productSku,
            name,
            segment: segment ?? "LUBRICANTS",
          },
        });

        if (ourPrice) {
          await prisma.productPriceVersion.create({
            data: {
              productId: product.id,
              ourPrice: ourPrice,
              effectiveFrom: new Date(),
              createdById: session.user!.id,
            },
          });
        }

        results.created++;
      }
    }

    await logAudit({
      action: "PRODUCT_IMPORT",
      actorId: session.user!.id,
      entityType: "Product",
      entityId: "batch",
      meta: {
        fileName: file.name,
        created: results.created,
        updated: results.updated,
        errors: results.errors.length,
      },
    });

    return NextResponse.json(results, { headers: withRequestIdHeader(req) });
  } catch (e) {
    if (e instanceof SecurityError) {
      return jsonError(req, { code: "SECURITY_ERROR", message: e.message }, e.status);
    }
    console.error("Product CSV import error:", e);
    return jsonError(req, { code: "INTERNAL_ERROR", message: "Internal Server Error" }, 500);
  }
}
