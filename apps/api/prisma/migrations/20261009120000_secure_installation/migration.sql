-- Preflight must resolve duplicate identities before applying this migration.
UPDATE "User" SET "email" = lower(trim("email"));
UPDATE "People" SET "email" = lower(trim("email"));
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "People_project_id_email_key" ON "People"("project_id", "email");
CREATE UNIQUE INDEX "Project_tenant_code_key" ON "Project"("tenant_code");
ALTER TABLE "User" ADD COLUMN "auth_version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "People" ADD COLUMN "auth_version" INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX "Role_one_default_per_project" ON "Role"("project_id") WHERE "is_default" = true;
CREATE TABLE "Installation" ("id" INTEGER PRIMARY KEY, "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
INSERT INTO "Installation" ("id") SELECT 1 WHERE EXISTS (SELECT 1 FROM "User");
CREATE TABLE "SecurityToken" ("hash" TEXT PRIMARY KEY, "purpose" TEXT NOT NULL, "subjectType" TEXT NOT NULL, "subjectId" INTEGER, "tenantId" INTEGER, "data" JSONB NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "SecurityToken_expiresAt_idx" ON "SecurityToken"("expiresAt");
CREATE INDEX "SecurityToken_subjectType_subjectId_purpose_idx" ON "SecurityToken"("subjectType", "subjectId", "purpose");
-- Legacy bearer magic tokens cannot be used by the new authentication endpoints.
