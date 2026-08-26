/*
  Warnings:

  - You are about to drop the column `publicId` on the `ProductVariant` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "ProductVariant_publicId_key";

-- AlterTable
ALTER TABLE "ProductVariant" DROP COLUMN "publicId";
