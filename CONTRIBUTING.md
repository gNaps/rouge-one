# Contributing

Use Node 22.21.1, pnpm 9.15.9 and Docker Compose 2.24.4+. Run `pnpm install --frozen-lockfile`, `pnpm run setup --dev`, then `pnpm dev`.

Before submitting: run `pnpm typecheck`, `pnpm build`, and `pnpm test`. Integration tests require `TEST_DATABASE_URL` pointing to a disposable PostgreSQL database whose name contains `test`; they truncate test data. Apply migrations there first. Browser tests use their own disposable database and the configuration in `playwright.config.ts`.

Include the problem, resulting behavior and relevant validation in pull requests. Keep changes focused. Add regression tests for authentication, authorization and migration changes. Never edit historical migrations: add new ones and test against a populated older database.

Contributions must be compatible with Apache-2.0. By submitting code you confirm you can license it under the project license. Preserve third-party attribution. Report vulnerabilities privately as described in SECURITY.md.

After changing production dependencies, run `pnpm run licenses` to regenerate the license inventory and notices. Run `pnpm release:check` before preparing a public release.

The Angular creation-only scaffold tests are not the release acceptance suite. The API integration and browser flow tests exercise actual behavior.

## Original repository history

The administrator and login histories are already connected to the API history by an `ours` merge. Original authors and commits remain reachable from the main branch. Local import backups are held in ignored `.local/history/*.bundle`; they are not needed by users cloning the published monorepo.
