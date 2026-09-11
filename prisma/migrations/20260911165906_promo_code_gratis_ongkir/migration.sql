-- CreateEnum
CREATE TYPE "PromoDiscountType" AS ENUM ('PRODUCT_PERCENTAGE', 'PRODUCT_FIXED', 'FREE_SHIPPING');

-- AlterTable
ALTER TABLE "Cart" ADD COLUMN     "productDiscountIdr" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "promoCodeId" INTEGER,
ADD COLUMN     "promoCodeString" TEXT,
ADD COLUMN     "shippingDiscountIdr" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "productDiscountIdr" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "promoCode" TEXT,
ADD COLUMN     "promoCodeId" INTEGER,
ADD COLUMN     "shippingDiscountIdr" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PromoCode" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "discountType" "PromoDiscountType" NOT NULL,
    "discountValue" DECIMAL(12,2) NOT NULL,
    "minSpendIdr" INTEGER NOT NULL DEFAULT 0,
    "maxDiscountIdr" INTEGER,
    "maxShippingDiscountIdr" INTEGER,
    "usageLimit" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "maxUsagePerUser" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoUsage" (
    "id" SERIAL NOT NULL,
    "promoCodeId" INTEGER NOT NULL,
    "userId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromoUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");

-- CreateIndex
CREATE INDEX "PromoCode_code_idx" ON "PromoCode"("code");

-- AddForeignKey
ALTER TABLE "PromoUsage" ADD CONSTRAINT "PromoUsage_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoUsage" ADD CONSTRAINT "PromoUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoUsage" ADD CONSTRAINT "PromoUsage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
