import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, withRequestIdHeader } from "@/lib/api-response";
import { requireAdmin, SecurityError } from "@/lib/security";

type CsvRow = {
  customerCode: string;
  name: string;
  lat: number;
  lng: number;
};

function parseCsvLine(line: string) {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i++;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  out.push(current.trim());
  return out;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const index = {
    customerCode: headers.indexOf("customerCode"),
    name: Math.max(headers.indexOf("name"), headers.indexOf("customerName")),
    lat: headers.indexOf("lat"),
    lng: headers.indexOf("lng"),
  };

  if (index.customerCode < 0 || index.name < 0 || index.lat < 0 || index.lng < 0) {
    throw new Error("CSV must include headers: customerCode, name (or customerName), lat, lng");
  }

  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const customerCode = cols[index.customerCode]?.trim();
    const name = cols[index.name]?.trim();
    const lat = Number(cols[index.lat]);
    const lng = Number(cols[index.lng]);

    if (!customerCode || !name) {
      throw new Error(`Row ${i + 1}: customerCode and name are required`);
    }
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      throw new Error(`Row ${i + 1}: lat must be between -90 and 90`);
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      throw new Error(`Row ${i + 1}: lng must be between -180 and 180`);
    }

    rows.push({ customerCode, name, lat, lng });
  }

  return rows;
}

export async function POST(req: Request) {
  try {
    await requireAdmin();

    const form = await req.formData();
    const file = form.get("file") as File | null;

    if (!file || file.size <= 0) {
      return jsonError(req, { code: "FILE_REQUIRED", message: "CSV file is required" }, 400);
    }

    const text = await file.text();
    const rows = parseCsv(text);

    let created = 0;
    let updated = 0;

    for (const row of rows) {
      const existing = await prisma.store.findUnique({ where: { customerCode: row.customerCode } });
      if (existing) {
        await prisma.store.update({
          where: { customerCode: row.customerCode },
          data: {
            name: row.name,
            lat: row.lat,
            lng: row.lng,
            active: true,
          },
        });
        updated++;
      } else {
        await prisma.store.create({
          data: {
            customerCode: row.customerCode,
            name: row.name,
            lat: row.lat,
            lng: row.lng,
          },
        });
        created++;
      }
    }

    return NextResponse.json(
      { ok: true, created, updated, total: rows.length },
      { headers: withRequestIdHeader(req) },
    );
  } catch (error) {
    if (error instanceof SecurityError) {
      return jsonError(req, { code: "SECURITY_ERROR", message: error.message }, error.status);
    }

    const message = error instanceof Error ? error.message : "Import failed";
    return jsonError(req, { code: "IMPORT_FAILED", message }, 400);
  }
}

export async function GET(req: Request) {
  try {
    await requireAdmin();

    const sample = [
      "customerCode,name,lat,lng",
      "CUST-001,Tienda Central Norte,12.1364,-86.2514",
      "CUST-002,Repuestos El Mercado,12.1122,-86.2260",
    ].join("\n");

    return new Response(sample, {
      headers: withRequestIdHeader(req, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="stores_sample.csv"',
      }),
    });
  } catch (error) {
    if (error instanceof SecurityError) {
      return jsonError(req, { code: "SECURITY_ERROR", message: error.message }, error.status);
    }
    return jsonError(req, { code: "INTERNAL_ERROR", message: "Internal Server Error" }, 500);
  }
}
