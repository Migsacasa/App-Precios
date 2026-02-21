/*
  Warnings:

  - Added the required column `customerCode` to the `Store` table without a default value. This is not possible if the table is not empty.
  - Added the required column `customerName` to the `Store` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "StoreEvaluation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "evaluatorUserId" TEXT NOT NULL,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aiOverallRating" TEXT NOT NULL DEFAULT 'NO_IMAGE',
    "aiSummary" TEXT,
    "aiJson" JSONB,
    "notes" TEXT,
    "gpsAtCaptureLat" REAL,
    "gpsAtCaptureLng" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StoreEvaluation_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StoreEvaluation_evaluatorUserId_fkey" FOREIGN KEY ("evaluatorUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EvaluationPhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "evaluationId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mime" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EvaluationPhoto_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "StoreEvaluation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EvaluationSegmentInput" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "evaluationId" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "priceIndex" REAL NOT NULL,
    "competitorName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EvaluationSegmentInput_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "StoreEvaluation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OurProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "segment" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "specs" TEXT,
    "ourPrice" DECIMAL NOT NULL,
    "referencePhotoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Store" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerCode" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "city" TEXT,
    "address" TEXT,
    "chain" TEXT,
    "competitorId" TEXT,
    "name" TEXT,
    "branch" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Store_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Store" (
    "id",
    "customerCode",
    "customerName",
    "lat",
    "lng",
    "city",
    "address",
    "chain",
    "competitorId",
    "name",
    "branch",
    "isActive",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    'LEGACY-' || "id" as "customerCode",
    COALESCE("name", 'Legacy Store ' || substr("id", 1, 6)) as "customerName",
    "lat",
    "lng",
    "city",
    "address",
    "branch" as "chain",
    "competitorId",
    "name",
    "branch",
    "isActive",
    "createdAt",
    "updatedAt"
FROM "Store";
DROP TABLE "Store";
ALTER TABLE "new_Store" RENAME TO "Store";
CREATE UNIQUE INDEX "Store_customerCode_key" ON "Store"("customerCode");
CREATE INDEX "Store_competitorId_idx" ON "Store"("competitorId");
CREATE INDEX "Store_city_idx" ON "Store"("city");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "StoreEvaluation_storeId_capturedAt_idx" ON "StoreEvaluation"("storeId", "capturedAt");

-- CreateIndex
CREATE INDEX "StoreEvaluation_evaluatorUserId_capturedAt_idx" ON "StoreEvaluation"("evaluatorUserId", "capturedAt");

-- CreateIndex
CREATE INDEX "EvaluationPhoto_evaluationId_idx" ON "EvaluationPhoto"("evaluationId");

-- CreateIndex
CREATE INDEX "EvaluationSegmentInput_segment_idx" ON "EvaluationSegmentInput"("segment");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationSegmentInput_evaluationId_segment_slot_key" ON "EvaluationSegmentInput"("evaluationId", "segment", "slot");

-- CreateIndex
CREATE INDEX "OurProduct_segment_idx" ON "OurProduct"("segment");
