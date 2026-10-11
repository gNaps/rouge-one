# Installation

## Bundled database

Run the quick start in the root README. PostgreSQL uses the `postgres_data` volume. Stopping or recreating containers preserves it. Removing the volume destroys the data; routine updates must not remove volumes.

`pnpm run setup --config-only` creates configuration without starting Docker. `docker compose --env-file .env.local up -d --build` starts the bundled stack. Database health checks precede the preflight and migration job; the API starts only after migrations succeed. View job output with `docker compose --env-file .env.local logs migrate`.

Port 8080 is bound to localhost. For remote access put a TLS reverse proxy in front, set `PUBLIC_URL` to the exact HTTPS origin and `NODE_ENV=production`. Proxy the complete origin, including `/api`, `/login` and `/example`. Secure cookies require HTTPS. Leave `TRUST_PROXY=false` unless the deployment isolates the API from direct connections and trusts its proxy.

Use strong, distinct `ADMIN_JWT_SECRET` and `PEOPLE_JWT_SECRET`. Preserve these values across upgrades. `BOOTSTRAP_TOKEN` must remain configured even when setup is closed. It is never returned by the public API. The setup command embeds it in the fragment of a private setup link. The page reads it into memory and removes the fragment from the address bar; it is not stored in browser storage or sent in HTTP URLs. Keep the printed link private until the first administrator is created. Reloading the setup page requires reopening the printed link.

## External PostgreSQL

Use a dedicated PostgreSQL database, not a schema shared with unrelated applications. PostgreSQL 16 is the tested baseline. The database user needs privileges to apply the published migrations; database creation remains the operator's responsibility.

```sh
pnpm run setup --config-only
# Edit DATABASE_URL in .env.local to point to your PostgreSQL database.
docker compose --env-file .env.local -f compose.yaml -f compose.external.yaml up -d --build
```

The override removes the bundled database dependency and passes `DATABASE_URL` to the application and migration job. Compose 2.24.4+ is required. Database hostnames must be reachable from containers; `localhost` inside a container is not the host machine.

Use the same compose file arguments for logs and later updates. A failed migration blocks startup rather than letting an incompatible application run.

## Email

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, and optionally `SMTP_USER` / `SMTP_PASSWORD`. Port 465 uses implicit TLS; other ports use SMTP with STARTTLS when offered. Configure a real sender address for production. No credentials are sent in API responses or logged by mail delivery errors.

For a local demonstration use Mailpit through the development profile. Magic links expire in 15 minutes. Delivery failure revokes the newly created token and returns the same generic public response.

## Google

For the administrator configure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Register the exact callback `PUBLIC_URL/api/auth/sign-in/google/callback`. Google can sign in an existing administrator; it cannot bypass first-run setup or register new administrators.

For each project configure credentials in its settings. Register the callback displayed there. Activate Google only when both credentials are configured. Callback validation requires verified provider email, one-use state and PKCE.

## Operations

`GET /api/health` returns 200 when PostgreSQL is reachable, 503 otherwise. Monitor health, API errors, migration failures and email-delivery warnings. Request logs omit query strings, cookies and bodies. Expired security tokens are removed periodically.

Container images are tagged by release. Replace the built-in `build` directives with published versioned images only after a registry release exists; the repository does not publish automatically.
