-- AlterTable
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE "Product" ADD COLUMN "embedding" vector(1024);
