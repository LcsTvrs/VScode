CREATE TABLE "UniformImage" (
    "id" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UniformImage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UniformImage_data_size" CHECK (octet_length("data") BETWEEN 1 AND 524288)
);

ALTER TABLE "UniformVariant" ADD COLUMN "imageId" TEXT;
CREATE INDEX "UniformVariant_imageId_idx" ON "UniformVariant"("imageId");
CREATE INDEX "UniformVariant_sku_idx" ON "UniformVariant"("sku");
ALTER TABLE "UniformVariant" ADD CONSTRAINT "UniformVariant_imageId_fkey"
    FOREIGN KEY ("imageId") REFERENCES "UniformImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
