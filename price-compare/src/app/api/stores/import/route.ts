import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, SecurityError } from "@/lib/security";

type CsvRow = {
  customerCode: string;
  customerName: string;
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
    customerName: headers.indexOf("customerName"),
    lat: headers.indexOf("lat"),
    lng: headers.indexOf("lng"),
  };

  if (Object.values(index).some((value) => value < 0)) {
    throw new Error("CSV must include headers: customerCode, customerName, lat, lng");
  }

  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const customerCode = cols[index.customerCode]?.trim();
    const customerName = cols[index.customerName]?.trim();
    const lat = Number(cols[index.lat]);
    const lng = Number(cols[index.lng]);

    if (!customerCode || !customerName) {
      throw new Error(`Row ${i + 1}: customerCode and customerName are required`);
    }
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      throw new Error(`Row ${i + 1}: lat must be between -90 and 90`);
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      throw new Error(`Row ${i + 1}: lng must be between -180 and 180`);
    }

    rows.push({ customerCode, customerName, lat, lng });
  }

  return rows;
}

export async function POST(req: Request) {
  try {
    await requireAdmin();

    const form = await req.formData();
    const file = form.get("file") as File | null;

    if (!file || file.size <= 0) {
      return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
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
            customerName: row.customerName,
            lat: row.lat,
            lng: row.lng,
            isActive: true,
          },
        });
        updated++;
      } else {
        await prisma.store.create({
          data: {
            customerCode: row.customerCode,
            customerName: row.customerName,
            lat: row.lat,
            lng: row.lng,
          },
        });
        created++;
      }
    }

    return NextResponse.json({ ok: true, created, updated, total: rows.length });
  } catch (error) {
    if (error instanceof SecurityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET() {
  try {
    await requireAdmin();

    const sample = [
      "customerCode,customerName,lat,lng",
      "CUST-001,Tienda Central Norte,12.1364,-86.2514",
      "CUST-002,Repuestos El Mercado,12.1122,-86.2260",
    ].join("\n");

    return new Response(sample, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="stores_sample.csv"',
      },
    });
  } catch (error) {
    if (error instanceof SecurityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
