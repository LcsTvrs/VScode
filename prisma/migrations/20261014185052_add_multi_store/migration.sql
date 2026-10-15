-- This migration upgrades the existing single-store application. Refuse to
-- guess which tenant owns legacy variants if the database already has more
-- than one store. Review and backfill those rows manually before retrying.
DO $$
DECLARE
    store_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO store_count FROM "Store";
    IF store_count > 1 THEN
        RAISE EXCEPTION 'Multi-store backfill is ambiguous: expected at most one Store before this migration, found %', store_count;
    END IF;
    IF store_count = 0 AND EXISTS (SELECT 1 FROM "UniformVariant") THEN
        RAISE EXCEPTION 'Cannot backfill UniformVariant.storeId: legacy variants exist but no Store exists';
    END IF;
END $$;

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('MASTER_ADMIN', 'STORE_ADMIN');

-- DropForeignKey
ALTER TABLE "RequestItem" DROP CONSTRAINT "RequestItem_requestId_fkey";

-- DropForeignKey
ALTER TABLE "RequestItem" DROP CONSTRAINT "RequestItem_variantId_fkey";

-- DropForeignKey
ALTER TABLE "StockLevel" DROP CONSTRAINT "StockLevel_variantId_fkey";

-- DropForeignKey
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_variantId_fkey";

-- DropForeignKey
ALTER TABLE "UniformRequest" DROP CONSTRAINT "UniformRequest_employeeId_fkey";

-- DropIndex
DROP INDEX "Employee_email_key";

-- DropIndex
DROP INDEX "Employee_ldap_key";

-- DropIndex
DROP INDEX "RequestItem_requestId_variantId_key";

-- DropIndex
DROP INDEX "StockLevel_quantity_minimum_idx";

-- DropIndex
DROP INDEX "StockMovement_variantId_createdAt_idx";

-- DropIndex
DROP INDEX "UniformRequest_code_key";

-- DropIndex
DROP INDEX "UniformRequest_status_createdAt_idx";

-- DropIndex
DROP INDEX "UniformRequest_storeId_createdAt_idx";

-- DropIndex
DROP INDEX "UniformVariant_category_size_idx";

-- DropIndex
DROP INDEX "UniformVariant_sku_key";

-- AlterTable
ALTER TABLE "RequestItem" ADD COLUMN     "storeId" TEXT;

-- AlterTable
ALTER TABLE "UniformVariant" ADD COLUMN     "storeId" TEXT;

-- Backfill legacy rows while the old foreign keys still describe their
-- relationships. The prior application supports one store only.
UPDATE "UniformVariant"
SET "storeId" = (SELECT "id" FROM "Store" ORDER BY "createdAt" ASC LIMIT 1);

UPDATE "RequestItem" AS item
SET "storeId" = request."storeId"
FROM "UniformRequest" AS request
WHERE item."requestId" = request."id";

ALTER TABLE "UniformVariant" ALTER COLUMN "storeId" SET NOT NULL;
ALTER TABLE "RequestItem" ALTER COLUMN "storeId" SET NOT NULL;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "storeId" TEXT,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_login_key" ON "User"("login");

-- CreateIndex
CREATE INDEX "User_storeId_role_idx" ON "User"("storeId", "role");

-- CreateIndex
CREATE INDEX "Employee_storeId_name_idx" ON "Employee"("storeId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_storeId_id_key" ON "Employee"("storeId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_storeId_ldap_key" ON "Employee"("storeId", "ldap");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_storeId_email_key" ON "Employee"("storeId", "email");

-- CreateIndex
CREATE INDEX "RequestItem_storeId_variantId_idx" ON "RequestItem"("storeId", "variantId");

-- CreateIndex
CREATE UNIQUE INDEX "RequestItem_storeId_requestId_variantId_key" ON "RequestItem"("storeId", "requestId", "variantId");

-- CreateIndex
CREATE INDEX "StockLevel_storeId_quantity_minimum_idx" ON "StockLevel"("storeId", "quantity", "minimum");

-- CreateIndex
CREATE INDEX "StockMovement_storeId_variantId_createdAt_idx" ON "StockMovement"("storeId", "variantId", "createdAt");

-- CreateIndex
CREATE INDEX "UniformRequest_storeId_status_createdAt_idx" ON "UniformRequest"("storeId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UniformRequest_storeId_id_key" ON "UniformRequest"("storeId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "UniformRequest_storeId_code_key" ON "UniformRequest"("storeId", "code");

-- CreateIndex
CREATE INDEX "UniformVariant_storeId_category_size_idx" ON "UniformVariant"("storeId", "category", "size");

-- CreateIndex
CREATE UNIQUE INDEX "UniformVariant_storeId_id_key" ON "UniformVariant"("storeId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "UniformVariant_storeId_sku_key" ON "UniformVariant"("storeId", "sku");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UniformVariant" ADD CONSTRAINT "UniformVariant_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLevel" ADD CONSTRAINT "StockLevel_storeId_variantId_fkey" FOREIGN KEY ("storeId", "variantId") REFERENCES "UniformVariant"("storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_storeId_variantId_fkey" FOREIGN KEY ("storeId", "variantId") REFERENCES "UniformVariant"("storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UniformRequest" ADD CONSTRAINT "UniformRequest_storeId_employeeId_fkey" FOREIGN KEY ("storeId", "employeeId") REFERENCES "Employee"("storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestItem" ADD CONSTRAINT "RequestItem_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestItem" ADD CONSTRAINT "RequestItem_storeId_requestId_fkey" FOREIGN KEY ("storeId", "requestId") REFERENCES "UniformRequest"("storeId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestItem" ADD CONSTRAINT "RequestItem_storeId_variantId_fkey" FOREIGN KEY ("storeId", "variantId") REFERENCES "UniformVariant"("storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
