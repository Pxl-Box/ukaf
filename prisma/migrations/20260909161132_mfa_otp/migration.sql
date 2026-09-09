-- AlterEnum
ALTER TYPE "TokenType" ADD VALUE 'MFA_LOGIN';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;
