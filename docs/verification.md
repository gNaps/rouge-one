# Local verification — 0.1.0 release candidate

Validated locally on 10 October 2026 with Node 22.21.1, PostgreSQL 16.11, Docker Desktop and Chrome on macOS.

- TypeScript checks passed for API, administrator panel and hosted login.
- Production builds passed for all three applications, including the Docker build and deployment of production-only API dependencies.
- 18 API tests passed in the authorization update. The optional real SMTP delivery test was skipped in this run; delivery had previously been verified with Mailpit. Coverage includes concurrent bootstrap, password checks, CSRF, tenant isolation, scoped CORS, PKCE and code replay, hashed single-use email tokens, expiry, password reset, provider state, pagination and session revocation. Authorization coverage includes reusable grants, claim contents, stale token/code rejection, unchanged-save behavior, concurrent default-role switches, role/permission CRUD, cross-project and cross-owner rejection, database foreign-key enforcement, and real HTTP acceptance of JWTs with 100 Unicode permission names.
- The historical-schema upgrade test preserved seeded account hashes and relationships, rejected conflicting data and schema drift before migration, backfilled legacy permission assignments into reusable grants, supported both historical and already-on-v0.1 schemas, and verified migration idempotence. All nine historical migration files remain byte-for-byte unchanged.
- The browser acceptance test passed: first administrator, project creation, hosted registration, PKCE callback, restored administrator session, permission and role creation, user-role assignment, rejection of the previous token, renewed login with verified role/permission claims, and logout.
- Setup-link checks cover missing and invalid links, reopening a link in an existing tab, encoded characters, automatic authorization, fragment removal, absence from browser storage, and closure after administrator creation.
- Dashboard, project creation (all three steps), integration, roles, permissions and user-table styles were inspected in Chrome at 1280 px, 375 px and 320 px, with light and dark themes. The acceptance flow also exercises the actual theme switch and mobile drawer navigation to roles, users and permissions after registering a project user.
- The monochrome universe restyle covers the dashboard, project wizard, integration, navigation, records, administrator access, setup, hosted login and integration example. Shared orbital artwork and authentication styles live in `packages/brand/universe.css`, without external image or font requests. The browser acceptance test exercises both Light and Dark controls.
- Real SMTP delivery was verified with Mailpit. Google exchange was simulated in integration tests.
- Docker startup completed with healthy services. Health and first-run setup status responded successfully on localhost:8080. The universe restyle and authorization update were rebuilt and started successfully with Compose. A local backup was saved before the authorization migration, and API writers were stopped for the schema update.
- The development command started all three applications. Angular's proxies successfully served the API, hosted login and integration example on port 4200.
- The external PostgreSQL Compose override successfully ran preflight and migrations against the disposable test server without starting a bundled database.
- Actual backup and restore commands preserved User/Project/People row counts. A second restore into the populated destination was refused.
- A separate probe database survived recreation of the bundled PostgreSQL container; installation tables were not modified by this check.
- The production dependency audit reported zero vulnerabilities. The license inventory contains 106 packages with no missing notices; 107 license/notice files were collected.
- Gitleaks scanned all imported Git histories and the distributable working tree without detecting secrets.

All database tests used dedicated disposable databases. The pre-existing configuration, original application database and sibling repositories were left unchanged. Git history was imported and connected locally; no repository or container image was published.

A live Google login with operator-provided credentials is still required before calling this a production release. GitHub Actions were configured but have not run remotely. Multiple roles per user, additional providers and offline JWT verification through JWKS remain outside v0.1.
