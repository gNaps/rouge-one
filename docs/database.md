# Database lifecycle

The source contains schema and migrations, never an installation's actual database. Each operator owns connection credentials, persistent storage and backups.

## Migration policy

Historical migrations are preserved byte-for-byte. They contain destructive changes and must not be replayed automatically over a partially upgraded database. The automatic path supports a new empty database or an installation with the complete historical migration chain and matching schema.

The preflight checks migration checksums and unfinished/unknown migrations, schema structure, normalized email conflicts, duplicate tenant codes, duplicate role/permission names within a project, multiple default roles and cross-project assignments. Conflicts stop the upgrade; no account is deleted or merged automatically. Work on a restored copy to reconcile an unsupported legacy state.

The v0.1 migration normalizes email, adds unique constraints, authentication versions, installation state and hashed security-token storage. Existing accounts and hashes remain valid. Legacy sessions and magic links stop working; users sign in again. Existing administrators mark first-run setup as complete.

The authorization migration replaces each legacy permission-to-role assignment with a reusable `RolePermission` association. Existing role and permission IDs and user assignments are preserved. Composite foreign keys enforce project isolation, and names become unique within each project. The migration is atomic and increments user authentication versions, so users sign in again. Preflight reports conflicting names for explicit reconciliation before upgrading.

Development uses `pnpm --filter @rouge-one/api db:dev`. Installations use `pnpm db:preflight`, then `pnpm db:migrate`. These commands read `.env.local`; Prisma CLI must be run with its `DATABASE_URL` in the environment, as the setup and Docker scripts do. Do not use database reset or schema push for production upgrades.

## Upgrade

1. Save a database backup and a protected copy of configuration/secrets.
2. Restore the backup into a dedicated staging database and test the new release there.
3. Stop application writers during the production migration.
4. Build/pull the target version and run its preflight and migration job once.
5. Start the API and check health, administrator login, project login and email delivery.

No downgrade SQL is generated. If an upgrade must be rolled back, restore its pre-upgrade backup into an empty database and use the matching earlier application version. Coordinate downtime so later writes are not silently lost.

## Backup and restore

For the included PostgreSQL:

```sh
pnpm backup
pnpm restore backups/rouge-one-TIMESTAMP.dump
```

Backup files are PostgreSQL custom-format dumps, excluded from Git and created with restricted filesystem permissions. Restore first checks that the destination contains no public tables, then restores in one transaction. It will refuse a populated target.

For external PostgreSQL, append `--external`; the backup utility connects from a temporary PostgreSQL tools container. Ensure DATABASE_URL is reachable there. For managed databases you can alternatively use the provider's backup tools.

Preserve configuration independently of the dump. Test restores regularly; a file's existence alone does not prove it can be restored. PostgreSQL major-version upgrades are separate operational changes and are not part of application updates.
