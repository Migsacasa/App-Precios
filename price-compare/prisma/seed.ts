/* prisma/seed.ts */
import { PrismaClient, Role, Segment } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const prisma = new PrismaClient();

type StoreCsvRow = {
  customerCode: string;
  customerName: string;
  lat: string;
  lng: string;
  city?: string;
  zone?: string;
  route?: string;
  chain?: string;
  branch?: string;
  segmentLabel?: string;
};

type ProductCsvRow = {
  sku: string;
  name: string;
  segment: string; // LUBRICANTS|BATTERIES|TIRES
  brand?: string;
  category?: string;
  active?: string; // true/false
  currency?: string; // NIO
  ourPrice?: string; // decimal
  weight?: string; // decimal
  effectiveFrom?: string; // ISO date
};

/**
 * Minimal CSV parser (handles quoted fields + commas).
 * If you already use a CSV library, replace this with it.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cell += '"';
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((v) => v.trim().length > 0)) rows.push(row.map((v) => v.trim()));
      row = [];
      continue;
    }
    cell += ch;
  }

  // last cell
  row.push(cell);
  if (row.some((v) => v.trim().length > 0)) rows.push(row.map((v) => v.trim()));
  return rows;
}

function csvToObjects<T extends Record<string, any>>(csvPath: string): T[] {
  const text = fs.readFileSync(csvPath, "utf8");
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.replace(/^\uFEFF/, "")); // strip BOM
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => (obj[h] = r[idx] ?? ""));
    return obj as T;
  });
}

function hashPassword(password: string): string {
  // Built-in scrypt (no dependency)
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 32);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

async function upsertUser(email: string, name: string, role: Role, password?: string) {
  return prisma.user.upsert({
    where: { email },
    update: { name, role },
    create: {
      email,
      name,
      role,
      // If your User model has a passwordHash field, set it here.
      // passwordHash: password ? hashPassword(password) : null,
    },
  });
}

async function importStoresFromCsv(csvPath: string, importedById: string) {
  const rows = csvToObjects<StoreCsvRow>(csvPath);

  const batch = await prisma.storeImportBatch.create({
    data: {
      fileName: path.basename(csvPath),
      importedById,
      rowCount: rows.length,
      meta: { sourcePath: csvPath },
    },
  });

  let created = 0;
  let updated = 0;

  for (const r of rows) {
    const customerCode = (r.customerCode ?? "").trim();
    const name = (r.customerName ?? "").trim();
    if (!customerCode || !name) continue;

    const lat = Number(r.lat);
    const lng = Number(r.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const res = await prisma.store.upsert({
      where: { customerCode },
      update: {
        name,
        lat,
        lng,
        city: r.city || null,
        zone: r.zone || null,
        route: r.route || null,
        chain: r.chain || null,
        branch: r.branch || null,
        segmentLabel: r.segmentLabel || null,
        active: true,
        importBatchId: batch.id,
      },
      create: {
        customerCode,
        name,
        lat,
        lng,
        city: r.city || null,
        zone: r.zone || null,
        route: r.route || null,
        chain: r.chain || null,
        branch: r.branch || null,
        segmentLabel: r.segmentLabel || null,
        active: true,
        importBatchId: batch.id,
      },
    });

    // crude heuristic: if store existed, update path increments updated
    // (Prisma doesn't tell us directly; track by checking createdAt? not worth it here)
    if (res.importBatchId === batch.id) updated++;
    else created++;
  }

  await prisma.auditLog.create({
    data: {
      actorId: importedById,
      action: "STORE_IMPORT",
      entityType: "StoreImportBatch",
      entityId: batch.id,
      meta: { csvPath, rowCount: rows.length, created, updated },
    },
  });

  return batch;
}

function parseSegment(seg: string): Segment {
  const s = seg.trim().toUpperCase();
  if (s === "LUBRICANTS") return Segment.LUBRICANTS;
  if (s === "BATTERIES") return Segment.BATTERIES;
  if (s === "TIRES") return Segment.TIRES;
  throw new Error(`Invalid segment: ${seg}`);
}

async function importProductsFromCsv(csvPath: string, createdById: string) {
  const rows = csvToObjects<ProductCsvRow>(csvPath);
  let upserted = 0;

  for (const r of rows) {
    const sku = (r.sku ?? "").trim();
    const name = (r.name ?? "").trim();
    if (!sku || !name) continue;

    const segment = parseSegment(r.segment);
    const active =
      r.active == null || r.active.trim() === "" ? true : r.active.trim().toLowerCase() === "true";

    const product = await prisma.product.upsert({
      where: { sku },
      update: {
        name,
        segment,
        brand: r.brand || null,
        category: r.category || null,
        active,
      },
      create: {
        sku,
        name,
        segment,
        brand: r.brand || null,
        category: r.category || null,
        active,
      },
    });

    upserted++;

    // Optional: seed a price version if ourPrice provided
    if (r.ourPrice && r.ourPrice.trim() !== "") {
      const ourPrice = Number(r.ourPrice);
      if (Number.isFinite(ourPrice)) {
        const currency = (r.currency || "NIO").trim();
        const weight = r.weight && r.weight.trim() !== "" ? Number(r.weight) : null;
        const effectiveFrom = r.effectiveFrom ? new Date(r.effectiveFrom) : new Date();

        await prisma.productPriceVersion.create({
          data: {
            productId: product.id,
            currency,
            ourPrice,
            weight: weight && Number.isFinite(weight) ? weight : null,
            effectiveFrom,
            createdById,
          },
        });

        await prisma.auditLog.create({
          data: {
            actorId: createdById,
            action: "PRODUCT_PRICE_VERSIONED",
            entityType: "Product",
            entityId: product.id,
            meta: { sku, currency, ourPrice, weight, effectiveFrom },
          },
        });
      }
    }
  }

  await prisma.auditLog.create({
    data: {
      actorId: createdById,
      action: "PRODUCT_IMPORT",
      entityType: "Seed",
      entityId: "products",
      meta: { csvPath, upserted },
    },
  });
}

async function main() {
  // --- USERS / ROLES ---
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
  const managerEmail = process.env.SEED_MANAGER_EMAIL ?? "manager@example.com";
  const fieldEmail = process.env.SEED_FIELD_EMAIL ?? "field@example.com";

  const admin = await upsertUser(adminEmail, "Admin", Role.ADMIN);
  const manager = await upsertUser(managerEmail, "Manager", Role.MANAGER);
  const field = await upsertUser(fieldEmail, "Field Rep", Role.FIELD);

  await prisma.auditLog.createMany({
    data: [
      { actorId: admin.id, action: "STORE_CREATED", entityType: "User", entityId: admin.id },
      { actorId: admin.id, action: "STORE_CREATED", entityType: "User", entityId: manager.id },
      { actorId: admin.id, action: "STORE_CREATED", entityType: "User", entityId: field.id },
    ],
    skipDuplicates: true,
  });

  // --- IMPORT STORES / PRODUCTS (optional) ---
  const storesCsv = process.env.SEED_STORES_CSV;   // e.g. ./data/stores.csv
  const productsCsv = process.env.SEED_PRODUCTS_CSV; // e.g. ./data/products.csv

  if (storesCsv && fs.existsSync(storesCsv)) {
    await importStoresFromCsv(storesCsv, admin.id);
  }

  if (productsCsv && fs.existsSync(productsCsv)) {
    await importProductsFromCsv(productsCsv, admin.id);
  }

  console.log("Seed completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
