BEGIN;
-- Preflight checks duplicate names and cross-project assignments before upgrading.
CREATE UNIQUE INDEX "Role_id_project_id_key" ON "Role"("id", "project_id");
CREATE UNIQUE INDEX "Role_project_id_name_key" ON "Role"("project_id", "name");
CREATE UNIQUE INDEX "Permission_id_project_id_key" ON "Permission"("id", "project_id");
CREATE UNIQUE INDEX "Permission_project_id_name_key" ON "Permission"("project_id", "name");
CREATE TABLE "RolePermission" (
    "role_id" INTEGER NOT NULL,
    "permission_id" INTEGER NOT NULL,
    "project_id" INTEGER NOT NULL,
    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("role_id", "permission_id"),
    CONSTRAINT "RolePermission_role_id_project_id_fkey" FOREIGN KEY ("role_id", "project_id") REFERENCES "Role"("id", "project_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RolePermission_permission_id_project_id_fkey" FOREIGN KEY ("permission_id", "project_id") REFERENCES "Permission"("id", "project_id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "RolePermission_permission_id_idx" ON "RolePermission"("permission_id");
-- Preserve existing assignments before replacing the one-role permission relationship.
INSERT INTO "RolePermission" ("role_id", "permission_id", "project_id")
SELECT "role_id", "id", "project_id" FROM "Permission" WHERE "role_id" IS NOT NULL;
ALTER TABLE "Permission" DROP CONSTRAINT "Permission_role_id_fkey";
ALTER TABLE "Permission" DROP COLUMN "role_id";
-- A person can only be assigned a role belonging to their own project.
ALTER TABLE "People" DROP CONSTRAINT "People_role_id_fkey";
ALTER TABLE "People" ADD CONSTRAINT "People_role_id_project_id_fkey" FOREIGN KEY ("role_id", "project_id") REFERENCES "Role"("id", "project_id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Existing access tokens and pending authorization flows are replaced at the next login.
UPDATE "People" SET "auth_version" = "auth_version" + 1;
COMMIT;
