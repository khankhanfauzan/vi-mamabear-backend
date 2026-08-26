/*
  Warnings:

  - You are about to drop the column `grandTotal` on the `Order` table. All the data in the column will be lost.
  - You are about to alter the column `subtotalIdr` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `shippingCostIdr` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `taxIdr` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to drop the column `grandPrice` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `priceIdr` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to drop the `ShippingAddress` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `updatedAt` to the `OrderStatusHistory` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "OrderStatusHistory" DROP CONSTRAINT "OrderStatusHistory_orderId_fkey";

-- DropForeignKey
ALTER TABLE "ShippingAddress" DROP CONSTRAINT "ShippingAddress_orderId_fkey";

-- DropIndex
DROP INDEX "OrderStatusHistory_orderId_key";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "grandTotal",
ALTER COLUMN "subtotalIdr" SET DEFAULT 0,
ALTER COLUMN "subtotalIdr" SET DATA TYPE INTEGER,
ALTER COLUMN "shippingCostIdr" SET DEFAULT 0,
ALTER COLUMN "shippingCostIdr" SET DATA TYPE INTEGER,
ALTER COLUMN "taxIdr" SET DEFAULT 0,
ALTER COLUMN "taxIdr" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "OrderItem" DROP COLUMN "grandPrice",
DROP COLUMN "priceIdr",
ADD COLUMN     "price" INTEGER,
ALTER COLUMN "quantity" SET DEFAULT 1,
ALTER COLUMN "productName" DROP NOT NULL,
ALTER COLUMN "variantName" DROP NOT NULL;

-- AlterTable
ALTER TABLE "OrderStatusHistory" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- DropTable
DROP TABLE "ShippingAddress";

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
