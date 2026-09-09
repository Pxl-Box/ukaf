/*
  Warnings:

  - Made the column `phone` on table `leads` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
ALTER TYPE "LeadSource" ADD VALUE 'WHATSAPP';

-- AlterTable
ALTER TABLE "leads" ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "phone" SET NOT NULL;
