-- AlterEnum
ALTER TYPE "SessionStatus" ADD VALUE 'CLOSED';

-- AlterTable
ALTER TABLE "Admin" ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "closedAt" TIMESTAMP(3);
