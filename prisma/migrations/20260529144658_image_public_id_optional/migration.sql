-- DropIndex
DROP INDEX "Image_publicId_key";

-- AlterTable
ALTER TABLE "Image" ALTER COLUMN "publicId" DROP NOT NULL;
