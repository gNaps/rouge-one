# Rouge One

Self-hosted authentication for multiple applications, with an administration panel and hosted login pages.

**0.1.0 release candidate.** Email/password, Google and email magic links are implemented. Production release still requires a live Google smoke test with your provider credentials. Project roles and permissions can be managed in the dashboard and are included in user access tokens. Each user has one role; permissions can be shared across roles.

## Quick start

Requires Node 22.21.1, pnpm 9.15.9 and Docker Compose 2.24.4 or later.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm run setup
```

Open the private setup link printed by the command and choose an administrator email and password. The link authorizes setup automatically; there is no token to copy into a form. It stops working after the first administrator is created. You can print it again with `pnpm run setup --config-only`.

Create a project with `http://localhost:8080/example/` as its callback. Keep email/password enabled, save, then click **Try login in the example application**. Register a project user to complete the first login. Google and SMTP are optional.

Setup generates `.env.local` with independent secrets. It never reads or overwrites a pre-existing `.env`, and it never resets a database. The default Docker installation has its own persistent PostgreSQL volume.

## Local development and email testing

```sh
pnpm run setup --dev
pnpm dev
```

Open the printed setup link after starting development servers. Subsequent visits use http://localhost:4200. Mailpit's email inbox is http://localhost:8025. Development setup exposes PostgreSQL on localhost:5433 and initializes the local schema. Do not point a development migration command at your production database.

If `.env.local` already exists, setup preserves it: set `PUBLIC_URL=http://localhost:4200` before switching to development mode. `PUBLIC_URL` must match the browser origin exactly.

For an all-Docker email demo, generate configuration, set `SMTP_HOST=mailpit`, and run:

```sh
pnpm run setup --config-only
docker compose --env-file .env.local -f compose.yaml -f compose.dev.yaml --profile dev up -d --build
```

Without SMTP, verification, password recovery and magic links are unavailable. Password login remains usable. With SMTP, verification links are available; email verification is recorded but does not block password login in v0.1.

## Guides

- [Installation and external PostgreSQL](docs/installation.md)
- [Application integration](docs/integration.md)
- [Database upgrades, backup and restore](docs/database.md)
- [Contributing](CONTRIBUTING.md)
- [Security reporting](SECURITY.md)
- [Changelog](CHANGELOG.md)
- [Release candidate verification](docs/verification.md)

## Project layout

`apps/api`: Fastify and Prisma. `apps/admin`: Angular. `apps/login`: React. `packages/contracts`: public API types. `examples/web`: complete browser PKCE example.

Each installation owns its database. Projects within an installation share PostgreSQL and are isolated by tenant checks. No credentials or application data are distributed in the source repository.

## License

Apache-2.0. See [LICENSE](LICENSE) and [third-party notices](NOTICE). Trademark rights are not granted by the software license.
