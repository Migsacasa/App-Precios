-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competitorId" TEXT NOT NULL,
    "chain" TEXT,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "lat" REAL,
    "lng" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Store_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Observation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "price" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NIO',
    "priceSource" TEXT NOT NULL DEFAULT 'MANUAL',
    "ocrText" TEXT,
    "storeId" TEXT,
    "storeName" TEXT,
    "city" TEXT,
    "notes" TEXT,
    "capturedLat" REAL,
    "capturedLng" REAL,
    "photoUrl" TEXT,
    "productId" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "capturedById" TEXT NOT NULL,
    CONSTRAINT "Observation_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Observation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Observation_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Observation_capturedById_fkey" FOREIGN KEY ("capturedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Observation" ("capturedAt", "capturedById", "city", "competitorId", "currency", "id", "notes", "photoUrl", "price", "productId", "storeName") SELECT "capturedAt", "capturedById", "city", "competitorId", "currency", "id", "notes", "photoUrl", "price", "productId", "storeName" FROM "Observation";
DROP TABLE "Observation";
ALTER TABLE "new_Observation" RENAME TO "Observation";
CREATE INDEX "Observation_capturedAt_idx" ON "Observation"("capturedAt");
CREATE INDEX "Observation_productId_competitorId_idx" ON "Observation"("productId", "competitorId");
CREATE INDEX "Observation_storeId_idx" ON "Observation"("storeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Store_competitorId_idx" ON "Store"("competitorId");

-- CreateIndex
CREATE INDEX "Store_city_idx" ON "Store"("city");
