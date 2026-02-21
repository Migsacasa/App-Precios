-- AlterTable
ALTER TABLE "Store" ADD COLUMN "route" TEXT;
ALTER TABLE "Store" ADD COLUMN "storeSegment" TEXT;
ALTER TABLE "Store" ADD COLUMN "zone" TEXT;

-- CreateTable
CREATE TABLE "ProductPriceHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "ourPrice" DECIMAL NOT NULL,
    "effectiveFrom" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductPriceHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "OurProduct" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event" TEXT NOT NULL,
    "userId" TEXT,
    "evaluationId" TEXT,
    "storeId" TEXT,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EvaluationPhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "evaluationId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mime" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "photoType" TEXT NOT NULL DEFAULT 'WIDE_SHOT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EvaluationPhoto_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "StoreEvaluation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_EvaluationPhoto" ("createdAt", "evaluationId", "height", "id", "mime", "url", "width") SELECT "createdAt", "evaluationId", "height", "id", "mime", "url", "width" FROM "EvaluationPhoto";
DROP TABLE "EvaluationPhoto";
ALTER TABLE "new_EvaluationPhoto" RENAME TO "EvaluationPhoto";
CREATE INDEX "EvaluationPhoto_evaluationId_idx" ON "EvaluationPhoto"("evaluationId");
CREATE TABLE "new_EvaluationSegmentInput" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "evaluationId" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "priceIndex" REAL NOT NULL,
    "competitorPrice" REAL,
    "ourPrice" REAL,
    "isManualOverride" BOOLEAN NOT NULL DEFAULT false,
    "competitorName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EvaluationSegmentInput_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "StoreEvaluation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_EvaluationSegmentInput" ("competitorName", "createdAt", "evaluationId", "id", "priceIndex", "segment", "slot") SELECT "competitorName", "createdAt", "evaluationId", "id", "priceIndex", "segment", "slot" FROM "EvaluationSegmentInput";
DROP TABLE "EvaluationSegmentInput";
ALTER TABLE "new_EvaluationSegmentInput" RENAME TO "EvaluationSegmentInput";
CREATE INDEX "EvaluationSegmentInput_segment_idx" ON "EvaluationSegmentInput"("segment");
CREATE UNIQUE INDEX "EvaluationSegmentInput_evaluationId_segment_slot_key" ON "EvaluationSegmentInput"("evaluationId", "segment", "slot");
CREATE TABLE "new_OurProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "segment" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "specs" TEXT,
    "ourPrice" DECIMAL NOT NULL,
    "referencePhotoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_OurProduct" ("createdAt", "id", "isActive", "ourPrice", "productName", "referencePhotoUrl", "segment", "specs", "updatedAt") SELECT "createdAt", "id", "isActive", "ourPrice", "productName", "referencePhotoUrl", "segment", "specs", "updatedAt" FROM "OurProduct";
DROP TABLE "OurProduct";
ALTER TABLE "new_OurProduct" RENAME TO "OurProduct";
CREATE INDEX "OurProduct_segment_idx" ON "OurProduct"("segment");
CREATE TABLE "new_StoreEvaluation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientEvaluationId" TEXT,
    "storeId" TEXT NOT NULL,
    "evaluatorUserId" TEXT NOT NULL,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aiOverallRating" TEXT NOT NULL DEFAULT 'NO_IMAGE',
    "aiScore" INTEGER,
    "aiConfidence" REAL,
    "aiSummary" TEXT,
    "aiWhyBullets" JSONB,
    "aiEvidence" JSONB,
    "aiRecommendations" JSONB,
    "aiJson" JSONB,
    "overrideRating" TEXT,
    "overriddenById" TEXT,
    "overriddenAt" DATETIME,
    "overrideReason" TEXT,
    "syncStatus" TEXT NOT NULL DEFAULT 'SYNCED',
    "notes" TEXT,
    "gpsAtCaptureLat" REAL,
    "gpsAtCaptureLng" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StoreEvaluation_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StoreEvaluation_evaluatorUserId_fkey" FOREIGN KEY ("evaluatorUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StoreEvaluation_overriddenById_fkey" FOREIGN KEY ("overriddenById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_StoreEvaluation" ("aiJson", "aiOverallRating", "aiSummary", "capturedAt", "createdAt", "evaluatorUserId", "gpsAtCaptureLat", "gpsAtCaptureLng", "id", "notes", "storeId", "updatedAt") SELECT "aiJson", "aiOverallRating", "aiSummary", "capturedAt", "createdAt", "evaluatorUserId", "gpsAtCaptureLat", "gpsAtCaptureLng", "id", "notes", "storeId", "updatedAt" FROM "StoreEvaluation";
DROP TABLE "StoreEvaluation";
ALTER TABLE "new_StoreEvaluation" RENAME TO "StoreEvaluation";
CREATE UNIQUE INDEX "StoreEvaluation_clientEvaluationId_key" ON "StoreEvaluation"("clientEvaluationId");
CREATE INDEX "StoreEvaluation_storeId_capturedAt_idx" ON "StoreEvaluation"("storeId", "capturedAt");
CREATE INDEX "StoreEvaluation_evaluatorUserId_capturedAt_idx" ON "StoreEvaluation"("evaluatorUserId", "capturedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ProductPriceHistory_productId_effectiveFrom_idx" ON "ProductPriceHistory"("productId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "AuditLog_event_idx" ON "AuditLog"("event");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_evaluationId_idx" ON "AuditLog"("evaluationId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Store_zone_idx" ON "Store"("zone");
