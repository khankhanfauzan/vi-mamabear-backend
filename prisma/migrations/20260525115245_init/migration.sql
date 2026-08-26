/*
  Warnings:

  - Added the required column `grandTotal` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "grandTotal" DECIMAL(10,2) NOT NULL;
