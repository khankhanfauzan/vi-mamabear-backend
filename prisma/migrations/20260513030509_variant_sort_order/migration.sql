-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "tags" SET DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;
