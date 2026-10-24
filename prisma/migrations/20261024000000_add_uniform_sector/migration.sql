ALTER TABLE "UniformVariant" ADD COLUMN "sector" TEXT NOT NULL DEFAULT 'Geral';
CREATE INDEX "UniformVariant_storeId_sector_name_idx" ON "UniformVariant"("storeId", "sector", "name");
