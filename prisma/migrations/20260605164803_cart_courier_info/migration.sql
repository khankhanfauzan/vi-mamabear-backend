/*
  Warnings:

  - The values [STAGING] on the enum `OrderStatus` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[orderId]` on the table `Cart` will be added. If there are existing duplicate values, this will fail.
  - Made the column `usedFor` on table `OrderAddress` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "OrderStatus_new" AS ENUM ('PAYMENT_PENDING', 'PAYMENT_PAID', 'PAYMENT_FAILED', 'CONFIRMED', 'PROCESSED', 'SENDING', 'RECEIVED', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'RETURNED');
ALTER TABLE "public"."Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "status" TYPE "OrderStatus_new" USING ("status"::text::"OrderStatus_new");
ALTER TABLE "OrderStatusHistory" ALTER COLUMN "status" TYPE "OrderStatus_new" USING ("status"::text::"OrderStatus_new");
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "public"."OrderStatus_old";
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'PAYMENT_PENDING';
COMMIT;

-- AlterTable
ALTER TABLE "Cart" ADD COLUMN     "courierCode" TEXT,
ADD COLUMN     "courierName" TEXT,
ADD COLUMN     "orderId" TEXT,
ADD COLUMN     "shippingCostIdr" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shippingMethod" TEXT,
ADD COLUMN     "subtotalIdr" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "taxIdr" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'PAYMENT_PENDING';

-- AlterTable
ALTER TABLE "OrderAddress" ALTER COLUMN "usedFor" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Cart_orderId_key" ON "Cart"("orderId");
