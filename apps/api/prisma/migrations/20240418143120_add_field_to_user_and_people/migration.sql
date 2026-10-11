/*
  Warnings:

  - You are about to drop the column `username` on the `People` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "People" DROP COLUMN "username",
ADD COLUMN     "firstname" TEXT,
ADD COLUMN     "surname" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "count_login" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "is_provider" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "last_login" TIMESTAMP(3),
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3),
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false;
