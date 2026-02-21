/*
  Warnings:

  - You are about to drop the `LoginLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `capturedLat` on the `Observation` table. All the data in the column will be lost.
  - You are about to drop the column `capturedLng` on the `Observation` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `Observation` table. All the data in the column will be lost.
  - You are about to drop the column `competitorId` on the `Observation` table. All the data in the column will be lost.
  - You are about to drop the column `photoUrl` on the `Observation` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `Observation` table. All the data in the column will be lost.
  - You are about to drop the column `priceSource` on the `Observation` table. All the data in the column will be lost.
  - You are about to drop the column `storeName` on the `Observation` table. All the data in the column will be lost.
  - You are about to drop the column `category` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `uom` on the `Product` table. All the data in the column will be lost.
  - You are about to alter the column `ourPrice` on the `Product` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Decimal`.
  - You are about to alter the column `weight` on the `Product` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Decimal`.
  - You are about to drop the column `chain` on the `Store` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `Competitor` table without a default value. This is not possible if the table is not empty.
  - Added the required column `observedPrice` to the `Observation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Observation` table without a default value. This is not possible if the table is not empty.
  - Made the column `storeId` on table `Observation` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `categoryId` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Store` table without a default value. This is not possible if the table is not empty.
  - Made the column `city` on table `Store` required. This step will fail if there are existing NULL values in that column.
  - Made the column `lat` on table `Store` required. This step will fail if there are existing NULL values in that column.
  - Made the column `lng` on table `Store` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "LoginLog_userId_idx";

-- DropIndex
DROP INDEX "LoginLog_loggedAt_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "LoginLog";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ObservationPhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "observationId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mime" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ObservationPhoto_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "Observation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiInsight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedById" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "storeId" TEXT,
    "competitorId" TEXT,
    "city" TEXT,
    "from" DATETIME,
    "to" DATETIME,
    "summary" TEXT NOT NULL,
    "json" JSONB NOT NULL,
    CONSTRAINT "AiInsight_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Competitor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "chain" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Competitor" ("createdAt", "id", "name") SELECT "createdAt", "id", "name" FROM "Competitor";
DROP TABLE "Competitor";
ALTER TABLE "new_Competitor" RENAME TO "Competitor";
CREATE TABLE "new_Observation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientUuid" TEXT,
    "storeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "capturedById" TEXT NOT NULL,
    "observedPrice" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NIO',
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "ocrText" TEXT,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "obsLat" REAL,
    "obsLng" REAL,
    "gpsAccuracyM" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Observation_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Observation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Observation_capturedById_fkey" FOREIGN KEY ("capturedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Observation" ("capturedAt", "capturedById", "currency", "id", "notes", "ocrText", "productId", "storeId") SELECT "capturedAt", "capturedById", "currency", "id", "notes", "ocrText", "productId", "storeId" FROM "Observation";
DROP TABLE "Observation";
ALTER TABLE "new_Observation" RENAME TO "Observation";
CREATE UNIQUE INDEX "Observation_clientUuid_key" ON "Observation"("clientUuid");
CREATE INDEX "Observation_storeId_capturedAt_idx" ON "Observation"("storeId", "capturedAt");
CREATE INDEX "Observation_productId_capturedAt_idx" ON "Observation"("productId", "capturedAt");
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "unit" TEXT,
    "ourPrice" DECIMAL NOT NULL,
    "weight" DECIMAL NOT NULL DEFAULT 1.0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("createdAt", "id", "name", "ourPrice", "sku", "weight") SELECT "createdAt", "id", "name", "ourPrice", "sku", "weight" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");
CREATE TABLE "new_Store" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competitorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "branch" TEXT,
    "address" TEXT,
    "city" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Store_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Store" ("address", "city", "competitorId", "createdAt", "id", "lat", "lng", "name") SELECT "address", "city", "competitorId", "createdAt", "id", "lat", "lng", "name" FROM "Store";
DROP TABLE "Store";
ALTER TABLE "new_Store" RENAME TO "Store";
CREATE INDEX "Store_competitorId_idx" ON "Store"("competitorId");
CREATE INDEX "Store_city_idx" ON "Store"("city");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'FIELD',
    "passwordHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "email", "id", "name", "passwordHash", "role") SELECT "createdAt", "email", "id", "name", "passwordHash", "role" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE INDEX "AiInsight_scope_idx" ON "AiInsight"("scope");

-- CreateIndex
CREATE INDEX "AiInsight_storeId_idx" ON "AiInsight"("storeId");

-- CreateIndex
CREATE INDEX "AiInsight_competitorId_idx" ON "AiInsight"("competitorId");
