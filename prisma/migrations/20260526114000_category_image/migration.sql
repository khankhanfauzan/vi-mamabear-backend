/*
  Warnings:

  - You are about to drop the column `altText` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `fileSize` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `format` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `height` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `publicId` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `width` on the `Category` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Category_publicId_key";

-- AlterTable
ALTER TABLE "Category" DROP COLUMN "altText",
DROP COLUMN "fileSize",
DROP COLUMN "format",
DROP COLUMN "height",
DROP COLUMN "imageUrl",
DROP COLUMN "publicId",
DROP COLUMN "width";

-- AlterTable
ALTER TABLE "Image" ADD COLUMN     "categoryId" INTEGER;

-- AddForeignKey
ALTER TABLE "Image" ADD CONSTRAINT "Image_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
