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

type ParseResult = {
  rows: CsvRow[];
  errors: string[];
};

function parseCsvLine(line: string, delimiter: "," | ";") {
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
    if (char === delimiter && !inQuotes) {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  out.push(current.trim());
  return out;
}

function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function resolveHeaderIndex(headers: string[], aliases: string[]) {
  const normalizedAliases = aliases.map((alias) => normalizeHeader(alias));
  return headers.findIndex((header) => normalizedAliases.includes(normalizeHeader(header)));
}

function parseCoordinate(raw: string, label: "lat" | "lng", rowNumber: number) {
  const normalized = raw.trim().replace(",", ".");
  const value = Number(normalized);

  if (!Number.isFinite(value)) {
    throw new Error(`Row ${rowNumber}: ${label} must be a valid number`);
  }

  return value;
}

function parseCsv(text: string): ParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return { rows: [], errors: [] };

  const headerLine = lines[0];
  const semicolonCount = (headerLine.match(/;/g) ?? []).length;
  const commaCount = (headerLine.match(/,/g) ?? []).length;
  const delimiter: "," | ";" = semicolonCount > commaCount ? ";" : ",";

  const headers = parseCsvLine(headerLine, delimiter).map((h) => h.trim());
  const index = {
    customerCode: resolveHeaderIndex(headers, [
      "customerCode",
      "customer_code",
      "codigo",
      "codigo_cliente",
      "storeCode",
    ]),
    name: resolveHeaderIndex(headers, ["name", "customerName", "storeName", "tienda", "nombre"]),
    lat: resolveHeaderIndex(headers, ["lat", "latitude", "latitud"]),
    lng: resolveHeaderIndex(headers, ["lng", "lon", "long", "longitude", "longitud"]),
  };

  if (index.customerCode < 0 || index.name < 0 || index.lat < 0 || index.lng < 0) {
    throw new Error(
      `CSV must include customer code, name, lat, and lng columns. Found headers: ${headers.join(", ") || "(none)"}`,
    );
  }

  const rows: CsvRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    try {
      const cols = parseCsvLine(lines[i], delimiter);
      const customerCode = cols[index.customerCode]?.trim();
      const name = cols[index.name]?.trim();

      if (!customerCode || !name) {
        throw new Error(`Row ${i + 1}: customerCode and name are required`);
      }

      const lat = parseCoordinate(cols[index.lat] ?? "", "lat", i + 1);
      const lng = parseCoordinate(cols[index.lng] ?? "", "lng", i + 1);

      if (lat < -90 || lat > 90) {
        throw new Error(`Row ${i + 1}: lat must be between -90 and 90`);
      }
      if (lng < -180 || lng > 180) {
        throw new Error(`Row ${i + 1}: lng must be between -180 and 180`);
      }

      rows.push({ customerCode, name, lat, lng });
    } catch (error) {
      const message = error instanceof Error ? error.message : `Row ${i + 1}: invalid data`;
      errors.push(message);
    }
  }

  return { rows, errors };
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
    const { rows, errors } = parseCsv(text);

    if (!rows.length) {
      return jsonError(
        req,
        {
          code: "IMPORT_FAILED",
          message: "No valid rows found in CSV",
          details: { errors },
        },
        400,
      );
    }

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
      { ok: true, created, updated, total: rows.length, skipped: errors.length, errors },
      { headers: withRequestIdHeader(req) },
    );
  } catch (error) {
    if (error instanceof SecurityError) {
      return jsonError(req, { code: "SECURITY_ERROR", message: error.message }, error.status);
    }

    console.error("Store CSV import error", {
      requestId: req.headers.get("x-request-id") ?? null,
      error,
    });

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
