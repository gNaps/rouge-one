-- DropForeignKey
ALTER TABLE "Permission" DROP CONSTRAINT "Permission_role_id_fkey";

-- AlterTable
ALTER TABLE "Permission" ALTER COLUMN "role_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;
