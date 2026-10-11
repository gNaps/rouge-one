/*
  Warnings:

  - Added the required column `for_people` to the `MagicToken` table without a default value. This is not possible if the table is not empty.
  - Added the required column `for_user` to the `MagicToken` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "MagicToken" DROP CONSTRAINT "MagicToken_project_id_fkey";

-- AlterTable
ALTER TABLE "MagicToken" ADD COLUMN     "for_people" BOOLEAN NOT NULL,
ADD COLUMN     "for_user" BOOLEAN NOT NULL,
ALTER COLUMN "project_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "MagicToken" ADD CONSTRAINT "MagicToken_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
