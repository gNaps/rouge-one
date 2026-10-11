# Integrating an application

Register your application's exact callback URL in project settings. Production callbacks require HTTPS; localhost HTTP is allowed for development. Fragments, credentials and arbitrary redirect URLs are rejected.

1. Generate a random PKCE verifier (43–128 characters), its SHA-256 base64url challenge, and a random state of at least 16 characters.
2. Store verifier/state locally for the pending flow. Open `/login/TENANT?redirect_uri=REGISTERED_CALLBACK&code_challenge=CHALLENGE&state=STATE` on the Rouge One origin.
3. On callback compare returned state with the stored value and remove the authorization parameters from browser history.
4. POST `/api/auth/TENANT/token` with `{ code, code_verifier, redirect_uri }`. The code expires after 60 seconds and can be exchanged once.
5. Keep the returned `access_token` in memory. Use `Authorization: Bearer TOKEN` with `/api/auth/TENANT/me`. Tokens expire after an hour; start a new login afterward.

The working browser implementation is in `examples/web/index.html`. Configure `PUBLIC_URL/example/` as the project's callback and open `/example/?tenant=TENANT` to try it. The example's local logout discards its token; password reset invalidates outstanding project access tokens server-side.

Cross-origin browser calls to config, token exchange and profile are permitted only from that project's registered callback origin. Administrative endpoints remain same-origin.

Project tokens include `kind=people`, issuer, tenant audience, subject, the existing numeric `role` ID, a `roles` array of role names, a `permissions` array of permission keys, and authentication version. Currently each user has one role. The token exchange and `/me` responses also include `user.role` (`id`, `name`) and `user.permissions`. Permission keys are case-sensitive. They are a snapshot at issuance, not a live lookup. They never authorize administrator routes. For a custom backend, validate all these properties; checking signature alone is insufficient. JWTs use an installation-held symmetric signing key in v0.1. Third-party applications must not receive that key: use the `/me` endpoint for online validation. JWKS and asymmetric offline validation are deferred.

Administrator sessions are HttpOnly cookies and require same-origin requests plus a CSRF header for authenticated writes. `GET /api/auth/me` returns the current administrator and CSRF token. Administrators are created through the protected first-run setup only.

Email links lead to a confirmation page and are consumed by POST, preventing simple email-link previews from spending credentials. Token destinations and purposes are checked independently.

## Roles and permissions

In project navigation, create keys such as `articles:read` and `articles:write` under **Permissions**. Under **Roles**, create or edit a role, select its permissions, and optionally make it the default for new registrations. A permission can be granted to several roles. Under **Users**, assign a role to an existing user. Users cannot choose their own role at signup. New roles grant no permissions until the administrator assigns them; each role supports up to 100 permissions.

An access token for an editor contains, alongside the standard identity and expiry claims:

```json
{
  "kind": "people",
  "tenant": "your-tenant",
  "role": 4,
  "roles": ["Editor"],
  "permissions": ["articles:read", "articles:write"],
  "version": 2
}
```

Your backend must validate the token through `/api/auth/TENANT/me` before authorizing a request, then require the relevant key in the returned `user.permissions`. For example, allow article creation only when this array contains `articles:write`; otherwise return HTTP 403. **Decoding a JWT in the browser does not validate it.** Frontend checks can hide controls but cannot secure your API.

Changing a user's role, a role's name or grants, or a granted permission's name/deletion increments the affected users' authentication versions. Old access tokens and pending sign-in codes fail online validation immediately; the user must sign in again. Changing the default role affects future registrations only. Saving unchanged access settings does not revoke users. Role deletion is refused while it is the default or has assigned users.

A previously issued JWT's contents cannot be edited or erased. A service that accepts only its signature and expiry will retain the old claims until expiry (up to one hour). Online validation is required for immediate revocation; the installation signing secret must not be distributed to applications.

Administrator operations use the same cookie session, origin and CSRF protection as project settings:

| Resource | Read | Create | Edit | Delete |
| --- | --- | --- | --- | --- |
| Roles | `GET /api/roles/TENANT` and `/:id` | `POST /api/roles/TENANT` | `PATCH /api/roles/TENANT/:id` | `DELETE /api/roles/TENANT/:id` |
| Permissions | `GET /api/permissions/TENANT` and `/:id` | `POST /api/permissions/TENANT` | `PATCH /api/permissions/TENANT/:id` | `DELETE /api/permissions/TENANT/:id` |

Role writes accept `{ name, permission_ids, is_default }`; create requires a name and defaults to no grants. Permission writes accept `{ name }`. Use `PATCH /api/people/TENANT/:id/role` with `{ role_id }` to assign a role. All IDs are checked against the project owned by the administrator. Catalog reads paginate with `page` (starting at 1) and `take` (up to 100), and can filter by `name`.
