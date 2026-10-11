/*
  Warnings:

  - You are about to drop the column `roleId` on the `People` table. All the data in the column will be lost.
  - Added the required column `role_id` to the `People` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "People" DROP CONSTRAINT "People_roleId_fkey";

-- AlterTable
ALTER TABLE "People" DROP COLUMN "roleId",
ADD COLUMN     "image" TEXT,
ADD COLUMN     "role_id" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "People" ADD CONSTRAINT "People_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
