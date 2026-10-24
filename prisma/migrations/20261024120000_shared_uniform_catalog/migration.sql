BEGIN;
-- Never choose one store's metadata silently when existing SKUs disagree.
DO $$ BEGIN
  IF EXISTS (
    SELECT "sku" FROM "UniformVariant" GROUP BY "sku"
    HAVING count(DISTINCT ROW("name", "sector", "category", "gender", "size", "imageId")) > 1
  ) THEN
    RAISE EXCEPTION 'Catálogo compartilhado: há SKUs com metadados divergentes entre lojas. Revisar antes de migrar.';
  END IF;
END $$;
ALTER TABLE "UniformVariant" ALTER COLUMN "category" TYPE TEXT USING "category"::TEXT;
ALTER TABLE "UniformVariant" ALTER COLUMN "color" SET DEFAULT '';
DROP TYPE "UniformCategory";
CREATE TABLE "UniformSector" ("name" TEXT PRIMARY KEY);
CREATE TABLE "UniformCategoryOption" ("name" TEXT PRIMARY KEY);
INSERT INTO "UniformSector" VALUES ('Geral'), ('Logística'), ('Atendimento'), ('Caixas'), ('Administrativo'), ('Comercial');
INSERT INTO "UniformSector" SELECT DISTINCT "sector" FROM "UniformVariant" ON CONFLICT DO NOTHING;
INSERT INTO "UniformCategoryOption" VALUES ('CAMISETA'), ('CALCA'), ('JAQUETA'), ('COLETE'), ('OUTRO');
CREATE UNIQUE INDEX "UniformSector_name_case_key" ON "UniformSector" (lower("name"));
CREATE UNIQUE INDEX "UniformCategoryOption_name_case_key" ON "UniformCategoryOption" (lower("name"));
CREATE TABLE "UniformCatalog" (
  "sku" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "sector" TEXT NOT NULL,
  "category" TEXT NOT NULL, "gender" "UniformGender", "size" TEXT NOT NULL,
  "imageId" TEXT, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UniformCatalog_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "UniformImage"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "UniformCatalog" ("sku", "name", "sector", "category", "gender", "size", "imageId")
SELECT DISTINCT ON ("sku") "sku", "name", "sector", "category", "gender", "size", "imageId" FROM "UniformVariant" ORDER BY "sku", "id";
ALTER TABLE "UniformVariant" ADD CONSTRAINT "UniformVariant_sku_fkey" FOREIGN KEY ("sku") REFERENCES "UniformCatalog"("sku") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Retain existing IDs, stock, movements and requests; only missing pairs get zero balances.
INSERT INTO "UniformVariant" ("id", "storeId", "sku", "name", "sector", "category", "gender", "size", "color", "imageId", "createdAt")
SELECT 'catalog-' || md5(s."id" || ':' || c."sku"), s."id", c."sku", c."name", c."sector", c."category", c."gender", c."size", '', c."imageId", CURRENT_TIMESTAMP
FROM "Store" s CROSS JOIN "UniformCatalog" c ON CONFLICT ("storeId", "sku") DO NOTHING;
INSERT INTO "StockLevel" ("id", "storeId", "variantId", "quantity", "minimum", "updatedAt")
SELECT 'catalog-stock-' || md5(v."id"), v."storeId", v."id", 0, 5, CURRENT_TIMESTAMP FROM "UniformVariant" v
ON CONFLICT ("storeId", "variantId") DO NOTHING;
ALTER TABLE "UniformCatalog" ALTER COLUMN "updatedAt" DROP DEFAULT;
COMMIT;
