-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "image" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" SERIAL NOT NULL,
    "google_client_id" TEXT,
    "google_secret_id" TEXT,
    "facebook_client_id" TEXT,
    "facebook_secret_id" TEXT,
    "twitch_client_id" TEXT,
    "twitch_secret_id" TEXT,
    "github_client_id" TEXT,
    "github_secret_id" TEXT,
    "is_google_active" BOOLEAN NOT NULL DEFAULT false,
    "is_facebook_active" BOOLEAN NOT NULL DEFAULT false,
    "is_twitch_active" BOOLEAN NOT NULL DEFAULT false,
    "is_password_active" BOOLEAN NOT NULL DEFAULT false,
    "is_magic_link_active" BOOLEAN NOT NULL DEFAULT false,
    "tenant_code" TEXT NOT NULL,
    "redirect_url" TEXT,
    "user_id" INTEGER NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "People" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "password" TEXT,
    "meta_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "last_login" TIMESTAMP(3),
    "count_login" INTEGER NOT NULL DEFAULT 0,
    "is_provider" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT,
    "project_id" INTEGER NOT NULL,
    "roleId" INTEGER NOT NULL,

    CONSTRAINT "People_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "project_id" INTEGER NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "role_id" INTEGER NOT NULL,
    "project_id" INTEGER NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MagicToken" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "expired_at" TIMESTAMP(3) NOT NULL,
    "email" TEXT NOT NULL,
    "project_id" INTEGER NOT NULL,

    CONSTRAINT "MagicToken_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "People" ADD CONSTRAINT "People_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "People" ADD CONSTRAINT "People_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicToken" ADD CONSTRAINT "MagicToken_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
