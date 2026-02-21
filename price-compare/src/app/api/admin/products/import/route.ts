import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, SecurityError } from "@/lib/security";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const VALID_SEGMENTS = ["LUBRICANTS", "BATTERIES", "TIRES"] as const;
type Segment = (typeof VALID_SEGMENTS)[number];

const rowSchema = z.object({
  name: z.string().min(1),
  segment: z.enum(VALID_SEGMENTS).optional(),
  ourPrice: z.coerce.number().positive().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "CSV file required" }, { status: 400 });
    }

    const text = await file.text();
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      return NextResponse.json({ error: "CSV must have header + at least 1 row" }, { status: 400 });
    }

    // Parse header
    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const nameIdx = header.indexOf("name");
    const segmentIdx = header.indexOf("segment");
    const priceIdx = header.findIndex((h) => h === "ourprice" || h === "our_price" || h === "price");

    if (nameIdx < 0) {
      return NextResponse.json({ error: "CSV must have a 'name' column" }, { status: 400 });
    }

    const results = { created: 0, updated: 0, errors: [] as string[] };

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim());
      const raw = {
        name: cols[nameIdx] ?? "",
        segment: segmentIdx >= 0 ? cols[segmentIdx]?.toUpperCase() : undefined,
        ourPrice: priceIdx >= 0 ? cols[priceIdx] : undefined,
      };

      const parsed = rowSchema.safeParse(raw);
      if (!parsed.success) {
        results.errors.push(`Row ${i + 1}: ${parsed.error.issues.map((e) => e.message).join(", ")}`);
        continue;
      }

      const { name, segment, ourPrice } = parsed.data;

      // Upsert product by productName
      const existing = await prisma.ourProduct.findFirst({
        where: { productName: name },
      });

      if (existing) {
        const oldPrice = Number(existing.ourPrice);
        await prisma.ourProduct.update({
          where: { id: existing.id },
          data: {
            ...(segment ? { segment } : {}),
            ourPrice: ourPrice ?? existing.ourPrice,
            effectiveFrom: ourPrice && ourPrice !== oldPrice ? new Date() : existing.effectiveFrom,
          },
        });

        // Record price history if price changed
        if (ourPrice && ourPrice !== oldPrice) {
          await prisma.productPriceHistory.create({
            data: {
              productId: existing.id,
              ourPrice: ourPrice,
              effectiveFrom: new Date(),
            },
          });
        }

        results.updated++;
      } else {
        const product = await prisma.ourProduct.create({
          data: {
            productName: name,
            segment: segment ?? "LUBRICANTS",
            ourPrice: ourPrice ?? 0,
            effectiveFrom: new Date(),
          },
        });

        if (ourPrice) {
          await prisma.productPriceHistory.create({
            data: {
              productId: product.id,
              ourPrice: ourPrice,
              effectiveFrom: new Date(),
            },
          });
        }

        results.created++;
      }
    }

    await logAudit({
      event: "csv.import.products",
      userId: session.user!.id,
      metadata: {
        fileName: file.name,
        created: results.created,
        updated: results.updated,
        errors: results.errors.length,
      },
    });

    return NextResponse.json(results);
  } catch (e) {
    if (e instanceof SecurityError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("Product CSV import error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
